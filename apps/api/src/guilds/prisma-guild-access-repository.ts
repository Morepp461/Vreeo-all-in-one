import type { DatabaseClient } from "@vreeo/database";
import type { AccessibleGuild, GuildAccessRepository } from "./types.js";

const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

export function hasManageGuildPermission(permissions: readonly string[]): boolean {
  for (const raw of permissions) {
    if (!/^\d{1,32}$/.test(raw)) continue;
    try {
      const bits = BigInt(raw);
      if ((bits & ADMINISTRATOR) === ADMINISTRATOR || (bits & MANAGE_GUILD) === MANAGE_GUILD) return true;
    } catch {
      // Ignore malformed cached permission data and fail closed.
    }
  }
  return false;
}

export class PrismaGuildAccessRepository implements GuildAccessRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async listManageableGuilds(discordUserId: string): Promise<AccessibleGuild[]> {
    const guilds = await this.prisma.guild.findMany({
      where: {
        active: true,
        botJoinedAt: { not: null },
        OR: [
          { ownerDiscordUserId: discordUserId },
          { members: { some: { discordUserId, isMember: true, leftAt: null } } },
        ],
      },
      select: {
        id: true,
        discordGuildId: true,
        name: true,
        iconUrl: true,
        ownerDiscordUserId: true,
        members: {
          where: { discordUserId, isMember: true, leftAt: null },
          select: { roles: { where: { removedAt: null }, select: { discordRoleId: true } } },
        },
        roles: { select: { discordRoleId: true, permissions: true } },
      },
      orderBy: { name: "asc" },
    });

    return guilds.flatMap((guild) => {
      // Repeat critical eligibility checks in application code rather than trusting a loose query/mock.
      if (!guild.active || guild.botJoinedAt === null) return [];
      if (guild.ownerDiscordUserId === discordUserId) {
        return [{ id: guild.id, discordGuildId: guild.discordGuildId, name: guild.name, iconUrl: guild.iconUrl, accessLevel: "owner" as const }];
      }
      const member = guild.members.find((item) => item.roles.length >= 0);
      if (!member || !member.roles.length) return [];
      const assignedRoleIds = new Set(member.roles.map((role) => role.discordRoleId));
      const rolePermissions = guild.roles
        .filter((role) => assignedRoleIds.has(role.discordRoleId))
        .map((role) => role.permissions);
      if (!hasManageGuildPermission(rolePermissions)) return [];
      return [{ id: guild.id, discordGuildId: guild.discordGuildId, name: guild.name, iconUrl: guild.iconUrl, accessLevel: "manage_guild" as const }];
    });
  }
}
