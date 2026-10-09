import { assertDiscordPermissions, DiscordServiceError, DiscordRestService, type DiscordApiRoute } from "@vreeo/discord";

const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

export interface LiveGuildAccess {
  allowed: boolean;
  isOwner: boolean;
  roleIds: string[];
  discordPermissions: string;
}

interface DiscordGuildResponse { id: string; owner_id: string; }
interface DiscordMemberResponse { user: { id: string }; roles: string[]; }
interface DiscordRoleResponse { id: string; permissions: string; position: number; managed: boolean; }

function isSnowflake(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,32}$/.test(value);
}
function invalidDiscordPayload(): never {
  throw new DiscordServiceError("DISCORD_API_ERROR", "Discord returned an invalid guild authorization response.");
}
function apiRoute(value: string): DiscordApiRoute { return value as DiscordApiRoute; }

/**
 * Revalidates a dashboard user's guild membership and administrative Discord
 * permissions at request time. It does not rely on persisted OAuth access tokens.
 */
export class DiscordGuildAccessService {
  constructor(private readonly rest: DiscordRestService) {}

  async inspectMember(discordGuildId: string, discordUserId: string): Promise<LiveGuildAccess> {
    if (!isSnowflake(discordGuildId) || !isSnowflake(discordUserId)) {
      throw new DiscordServiceError("DISCORD_RESOURCE_NOT_FOUND", "Discord guild or user ID is invalid.");
    }
    const guild = await this.rest.request<DiscordGuildResponse>({
      method: "GET",
      route: apiRoute("/guilds/" + discordGuildId),
      context: { operation: "guild.access.guild", guildId: discordGuildId },
    });
    if (!guild || guild.id !== discordGuildId || !isSnowflake(guild.owner_id)) invalidDiscordPayload();
    if (guild.owner_id === discordUserId) {
      return { allowed: true, isOwner: true, roleIds: [discordGuildId], discordPermissions: ADMINISTRATOR.toString() };
    }

    const [member, roles] = await Promise.all([
      this.rest.request<DiscordMemberResponse>({
        method: "GET",
        route: apiRoute("/guilds/" + discordGuildId + "/members/" + discordUserId),
        context: { operation: "guild.access.member", guildId: discordGuildId },
      }),
      this.rest.request<DiscordRoleResponse[]>({
        method: "GET",
        route: apiRoute("/guilds/" + discordGuildId + "/roles"),
        context: { operation: "guild.access.roles", guildId: discordGuildId },
      }),
    ]);
    if (!member || !member.user || member.user.id !== discordUserId || !Array.isArray(member.roles) ||
      !member.roles.every(isSnowflake) || !Array.isArray(roles)) invalidDiscordPayload();
    for (const role of roles) {
      if (!role || !isSnowflake(role.id) || typeof role.permissions !== "string" || !/^\d{1,24}$/.test(role.permissions) ||
        !Number.isSafeInteger(role.position) || role.position < 0 || typeof role.managed !== "boolean") invalidDiscordPayload();
    }

    const assignedRoleIds = new Set([discordGuildId, ...member.roles]);
    const effective = roles.filter((role) => assignedRoleIds.has(role.id));
    let permissions = 0n;
    try {
      for (const role of effective) permissions |= BigInt(role.permissions);
    } catch {
      invalidDiscordPayload();
    }
    const allowed = (permissions & (ADMINISTRATOR | MANAGE_GUILD)) !== 0n;
    return {
      allowed,
      isOwner: false,
      roleIds: [...assignedRoleIds],
      discordPermissions: permissions.toString(),
    };
  }

  assertRequiredPermissions(granted: readonly string[], required: readonly string[]): void {
    assertDiscordPermissions(required, granted);
  }
}
