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
        active: true,
        botJoinedAt: true,
        members: {
          where: { discordUserId, isMember: true, leftAt: null },
          select: { roles: { where: { removedAt: null }, select: { discordRoleId: true } } },
        },
        roles: { select: { discordRoleId: true, permissions: true } },
      },
      orderBy: { name: "asc" },
    });

    const accessible: AccessibleGuild[] = [];
    for (const guild of guilds) {
      // Repeat critical eligibility checks in application code rather than trusting a loose query/mock.
      if (!guild.active || guild.botJoinedAt === null) continue;
      if (guild.ownerDiscordUserId === discordUserId) {
        accessible.push({
          id: guild.id,
          discordGuildId: guild.discordGuildId,
          name: guild.name,
          iconUrl: guild.iconUrl,
          accessLevel: "owner",
        });
        continue;
      }
      const member = guild.members[0];
      if (!member || member.roles.length === 0) continue;
      const assignedRoleIds = new Set(member.roles.map((role) => role.discordRoleId));
      const rolePermissions = guild.roles
        .filter((role) => assignedRoleIds.has(role.discordRoleId))
        .map((role) => role.permissions);
      if (!hasManageGuildPermission(rolePermissions)) continue;
      accessible.push({
        id: guild.id,
        discordGuildId: guild.discordGuildId,
        name: guild.name,
        iconUrl: guild.iconUrl,
        accessLevel: "manage_guild",
      });
    }
    return accessible;
  }
}
