import type { DatabaseClient } from "@vreeo/database";
import type { Guild } from "discord.js";

export async function syncBotGuild(database: DatabaseClient, discordGuild: Guild, now = new Date()): Promise<void> {
  const existing = await database.guild.findUnique({ where: { discordGuildId: discordGuild.id }, select: { botJoinedAt: true } });
  const botJoinedAt = existing?.botJoinedAt ?? now;
  await database.guild.upsert({
    where: { discordGuildId: discordGuild.id },
    create: {
      discordGuildId: discordGuild.id, name: discordGuild.name.slice(0, 200),
      iconUrl: discordGuild.iconURL({ size: 256 }) ?? "", ownerDiscordUserId: discordGuild.ownerId,
      active: true, botJoinedAt, lastSeenAt: now,
    },
    update: {
      name: discordGuild.name.slice(0, 200), iconUrl: discordGuild.iconURL({ size: 256 }) ?? "",
      ownerDiscordUserId: discordGuild.ownerId, active: true, botJoinedAt, lastSeenAt: now,
    },
  });
}
export async function markBotGuildLeft(database: DatabaseClient, discordGuildId: string, now = new Date()): Promise<void> {
  await database.guild.updateMany({ where: { discordGuildId }, data: { active: false, botJoinedAt: null, lastSeenAt: now } });
}
