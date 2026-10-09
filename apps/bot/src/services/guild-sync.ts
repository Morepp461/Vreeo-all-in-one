import type { Guild } from 'discord.js';
import { prisma } from '@vreeo/database/client';

export async function syncGuild(guild: Guild) {
  const now = new Date();
  return prisma.guild.upsert({
    where: { discordGuildId: guild.id },
    create: {
      discordGuildId: guild.id,
      name: guild.name,
      iconUrl: guild.iconURL(),
      ownerDiscordUserId: guild.ownerId,
      botJoinedAt: now,
      lastSeenAt: now,
    },
    update: {
      name: guild.name,
      iconUrl: guild.iconURL(),
      ownerDiscordUserId: guild.ownerId,
      active: true,
      lastSeenAt: now,
    },
    select: { id: true },
  });
}

export async function markGuildLeft(guild: Guild) {
  await prisma.guild.updateMany({
    where: { discordGuildId: guild.id },
    data: { active: false, lastSeenAt: new Date() },
  });
}
