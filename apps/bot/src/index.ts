import "dotenv/config";
import { createDatabaseClient } from "@vreeo/database";
import { loadBotConfig } from "@vreeo/config";
import { createLogger } from "@vreeo/logger";
import { Client, Events, GatewayIntentBits, type Guild } from "discord.js";
import { markGuildMemberDeparted, syncGuildChannels, syncGuildMember, syncGuildMetadata, syncGuildRoles, syncGuildSnapshot } from "./sync/guild-sync.js";

const config = loadBotConfig();
const logger = createLogger({ service: "bot", level: config.logLevel });
const database = createDatabaseClient({ url: config.databaseUrl });
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  allowedMentions: { parse: [], repliedUser: false },
});

async function syncGuildSafely(guild: Guild, reason: string): Promise<void> {
  try {
    const result = await syncGuildSnapshot(guild, database);
    logger.info({
      discordGuildId: guild.id,
      reason,
      memberSnapshotCount: result.memberCount,
      memberSnapshotAvailable: result.memberCount !== null,
    }, "Guild snapshot synchronized");
    if (result.memberCount === null) {
      logger.warn({ discordGuildId: guild.id }, "Guild member snapshot unavailable; enable the privileged Server Members Intent in the Discord Developer Portal");
    }
  } catch (error) {
    logger.error({ err: error, discordGuildId: guild.id, reason }, "Guild snapshot synchronization failed");
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  logger.info({ botUserId: readyClient.user.id, guildCount: readyClient.guilds.cache.size }, "Discord gateway connected");
  for (const guild of readyClient.guilds.cache.values()) await syncGuildSafely(guild, "startup");
});
client.on(Events.GuildCreate, (guild) => { void syncGuildSafely(guild, "guild_create"); });
client.on(Events.GuildUpdate, (_oldGuild, guild) => {
  void (async () => {
    const guildId = await syncGuildMetadata(guild, database);
    await syncGuildRoles(guild, database, guildId);
    await syncGuildChannels(guild, database, guildId);
    logger.info({ discordGuildId: guild.id }, "Guild metadata synchronized");
  })().catch((error: unknown) => logger.error({ err: error, discordGuildId: guild.id }, "Guild metadata synchronization failed"));
});
client.on(Events.GuildDelete, (guild) => {
  void database.guild.updateMany({
    where: { discordGuildId: guild.id },
    data: { active: false, botJoinedAt: null, lastSeenAt: new Date() },
  }).catch((error: unknown) => logger.error({ err: error, discordGuildId: guild.id }, "Guild deactivation failed"));
});
client.on(Events.GuildRoleCreate, (role) => { void syncGuildRoles(role.guild, database).catch((error: unknown) => logger.error({ err: error, discordGuildId: role.guild.id }, "Guild role sync failed")); });
client.on(Events.GuildRoleUpdate, (_oldRole, role) => { void syncGuildRoles(role.guild, database).catch((error: unknown) => logger.error({ err: error, discordGuildId: role.guild.id }, "Guild role sync failed")); });
client.on(Events.GuildRoleDelete, (role) => { void syncGuildRoles(role.guild, database).catch((error: unknown) => logger.error({ err: error, discordGuildId: role.guild.id }, "Guild role sync failed")); });
client.on(Events.GuildMemberAdd, (member) => { void syncGuildMember(member, database).catch((error: unknown) => logger.error({ err: error, discordGuildId: member.guild.id }, "Guild member sync failed")); });
client.on(Events.GuildMemberUpdate, (_oldMember, member) => { void syncGuildMember(member, database).catch((error: unknown) => logger.error({ err: error, discordGuildId: member.guild.id }, "Guild member sync failed")); });
client.on(Events.GuildMemberRemove, (member) => {
  void markGuildMemberDeparted(member.guild.id, member.id, database)
    .catch((error: unknown) => logger.error({ err: error, discordGuildId: member.guild.id }, "Guild member removal sync failed"));
});

client.on(Events.Error, (error) => logger.error({ err: error }, "Discord client error"));

let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down Discord bot");
  client.destroy();
  try { await database.$disconnect(); }
  catch (error) { logger.error({ err: error }, "Database shutdown failed"); process.exitCode = 1; }
};
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await database.$connect();
  await client.login(config.discordToken);
} catch (error) {
  logger.fatal({ err: error }, "Discord bot failed to start");
  client.destroy();
  await database.$disconnect().catch((disconnectError: unknown) => logger.error({ err: disconnectError }, "Database shutdown failed"));
  process.exitCode = 1;
}
