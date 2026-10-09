import type { DatabaseClient } from "@vreeo/database";
import type { Guild, GuildMember } from "discord.js";

const MEMBER_BATCH_SIZE = 20;
const memberSyncs = new Map<string, Promise<void>>();

async function withMemberLock(key: string, operation: () => Promise<void>): Promise<void> {
  const previous = memberSyncs.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  memberSyncs.set(key, current);
  try { await current; }
  finally { if (memberSyncs.get(key) === current) memberSyncs.delete(key); }
}

async function inBatches<T>(items: readonly T[], size: number, operation: (item: T) => Promise<void>): Promise<void> {
  for (let offset = 0; offset < items.length; offset += size) {
    await Promise.all(items.slice(offset, offset + size).map(operation));
  }
}

export async function syncGuildMetadata(guild: Guild, database: DatabaseClient) {
  const now = new Date();
  const ownerDiscordUserId = guild.ownerId ?? (await guild.fetchOwner()).id;
  const existing = await database.guild.findUnique({
    where: { discordGuildId: guild.id },
    select: { id: true, botJoinedAt: true },
  });
  const record = await database.guild.upsert({
    where: { discordGuildId: guild.id },
    create: {
      discordGuildId: guild.id,
      name: guild.name.slice(0, 200),
      iconUrl: guild.iconURL() ?? "",
      ownerDiscordUserId,
      active: true,
      botJoinedAt: now,
      lastSeenAt: now,
    },
    update: {
      name: guild.name.slice(0, 200),
      iconUrl: guild.iconURL() ?? "",
      ownerDiscordUserId,
      active: true,
      botJoinedAt: existing?.botJoinedAt ?? now,
      lastSeenAt: now,
    },
    select: { id: true },
  });
  await database.guildSetting.upsert({
    where: { guildId: record.id },
    create: { guildId: record.id, locale: "en", timezone: "UTC", config: {} },
    update: {},
  });
  return record.id;
}

export async function syncGuildRoles(guild: Guild, database: DatabaseClient, internalGuildId?: string): Promise<void> {
  const guildId = internalGuildId ?? (await database.guild.findUniqueOrThrow({
    where: { discordGuildId: guild.id }, select: { id: true },
  })).id;
  const roles = [...guild.roles.cache.values()];
  for (const role of roles) {
    await database.guildRole.upsert({
      where: { guildId_discordRoleId: { guildId, discordRoleId: role.id } },
      create: {
        guildId, discordRoleId: role.id, name: role.name.slice(0, 100),
        position: role.position, managed: role.managed, permissions: role.permissions.bitfield.toString(), color: role.color,
      },
      update: {
        name: role.name.slice(0, 100), position: role.position, managed: role.managed,
        permissions: role.permissions.bitfield.toString(), color: role.color,
      },
    });
  }
  const roleIds = roles.map((role) => role.id);
  if (roleIds.length > 0) {
    await database.guildRole.deleteMany({ where: { guildId, discordRoleId: { notIn: roleIds } } });
  }
}

export async function syncGuildChannels(guild: Guild, database: DatabaseClient, internalGuildId?: string): Promise<void> {
  const guildId = internalGuildId ?? (await database.guild.findUniqueOrThrow({
    where: { discordGuildId: guild.id }, select: { id: true },
  })).id;
  for (const channel of guild.channels.cache.values()) {
    const position = "position" in channel && typeof channel.position === "number" ? channel.position : 0;
    await database.guildChannel.upsert({
      where: { guildId_discordChannelId: { guildId, discordChannelId: channel.id } },
      create: {
        guildId, discordChannelId: channel.id, parentDiscordChannelId: channel.parentId,
        name: channel.name.slice(0, 100), type: String(channel.type), position,
      },
      update: {
        parentDiscordChannelId: channel.parentId,
        name: channel.name.slice(0, 100), type: String(channel.type), position,
      },
    });
  }
}

async function syncOneMember(member: GuildMember, database: DatabaseClient, internalGuildId: string, userId?: string): Promise<void> {
  const now = new Date();
  const where = { guildId_discordUserId: { guildId: internalGuildId, discordUserId: member.id } };
  const existing = await database.guildMember.findUnique({ where, select: { id: true, userId: true } });
  const memberRecord = await database.guildMember.upsert({
    where,
    create: {
      guildId: internalGuildId,
      ...(userId ? { userId } : {}),
      discordUserId: member.id,
      nickname: member.nickname,
      joinedAt: member.joinedAt ?? now,
      leftAt: null,
      isMember: true,
      isVerified: false,
      metadata: {},
    },
    update: {
      ...(userId ? { userId } : existing?.userId ? { userId: existing.userId } : {}),
      nickname: member.nickname,
      leftAt: null,
      isMember: true,
    },
    select: { id: true },
  });

  const currentRoleIds = [...member.roles.cache.keys()].filter((roleId) => roleId !== member.guild.id);
  const activeRoleRows = await database.guildMemberRole.findMany({
    where: { memberId: memberRecord.id, removedAt: null },
    select: { discordRoleId: true },
  });
  const activeRoleIds = new Set(activeRoleRows.map((role) => role.discordRoleId));
  const currentRoleSet = new Set(currentRoleIds);
  const removedRoleIds = [...activeRoleIds].filter((roleId) => !currentRoleSet.has(roleId));
  if (removedRoleIds.length > 0) {
    await database.guildMemberRole.updateMany({
      where: { memberId: memberRecord.id, removedAt: null, discordRoleId: { in: removedRoleIds } },
      data: { removedAt: now },
    });
  }
  const addedRoleIds = currentRoleIds.filter((roleId) => !activeRoleIds.has(roleId));
  if (addedRoleIds.length > 0) {
    await database.guildMemberRole.createMany({
      data: addedRoleIds.map((discordRoleId) => ({ guildId: internalGuildId, memberId: memberRecord.id, discordRoleId, assignedAt: now })),
    });
  }
}

export async function syncGuildMember(member: GuildMember, database: DatabaseClient, internalGuildId?: string): Promise<void> {
  await withMemberLock(`${member.guild.id}:${member.id}`, async () => {
    const guildId = internalGuildId ?? (await database.guild.findUniqueOrThrow({
      where: { discordGuildId: member.guild.id }, select: { id: true },
    })).id;
    const user = await database.user.findUnique({ where: { discordUserId: member.id }, select: { id: true } });
    await syncOneMember(member, database, guildId, user?.id);
  });
}

export async function syncGuildMemberSnapshot(guild: Guild, database: DatabaseClient, internalGuildId: string): Promise<number> {
  // GuildMembers is a privileged Discord intent. If it is unavailable, the caller logs the failure and owner access remains available.
  const members = [...(await guild.members.fetch()).values()];
  const memberIds = members.map((member) => member.id);
  const knownUsers = memberIds.length === 0 ? [] : await database.user.findMany({
    where: { discordUserId: { in: memberIds } },
    select: { id: true, discordUserId: true },
  });
  const userIds = new Map(knownUsers.map((user) => [user.discordUserId, user.id]));
  await inBatches(members, MEMBER_BATCH_SIZE, async (member) => {
    await withMemberLock(`${guild.id}:${member.id}`, () =>
      syncOneMember(member, database, internalGuildId, userIds.get(member.id)));
  });

  const existingMembers = await database.guildMember.findMany({
    where: { guildId: internalGuildId, isMember: true },
    select: { id: true, discordUserId: true },
  });
  const currentIds = new Set(memberIds);
  const departed = existingMembers.filter((member) => !currentIds.has(member.discordUserId));
  if (departed.length > 0) {
    const departedIds = departed.map((member) => member.id);
    const now = new Date();
    await database.guildMember.updateMany({
      where: { id: { in: departedIds }, isMember: true },
      data: { isMember: false, leftAt: now },
    });
    await database.guildMemberRole.updateMany({
      where: { memberId: { in: departedIds }, removedAt: null },
      data: { removedAt: now },
    });
  }
  return members.length;
}

export async function markGuildMemberDeparted(guildDiscordId: string, discordUserId: string, database: DatabaseClient): Promise<void> {
  await withMemberLock(`${guildDiscordId}:${discordUserId}`, async () => {
    const guild = await database.guild.findUnique({ where: { discordGuildId: guildDiscordId }, select: { id: true } });
    if (!guild) return;
    const existing = await database.guildMember.findUnique({
      where: { guildId_discordUserId: { guildId: guild.id, discordUserId } },
      select: { id: true },
    });
    if (!existing) return;
    const now = new Date();
    await database.guildMember.update({ where: { id: existing.id }, data: { isMember: false, leftAt: now } });
    await database.guildMemberRole.updateMany({ where: { memberId: existing.id, removedAt: null }, data: { removedAt: now } });
  });
}

export async function syncGuildSnapshot(guild: Guild, database: DatabaseClient): Promise<{ guildId: string; memberCount: number | null }> {
  const guildId = await syncGuildMetadata(guild, database);
  await syncGuildRoles(guild, database, guildId);
  await syncGuildChannels(guild, database, guildId);
  let memberCount: number | null = null;
  try {
    memberCount = await syncGuildMemberSnapshot(guild, database, guildId);
  } catch {
    // A missing privileged intent or transient Discord error must not prevent basic guild metadata from syncing.
  }
  return { guildId, memberCount };
}
