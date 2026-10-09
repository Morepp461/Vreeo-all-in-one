import "dotenv/config";
import { createDatabaseClient } from "@vreeo/database";
import { loadBotConfig } from "@vreeo/config";
import { createLogger } from "@vreeo/logger";
import { Client, Events, GatewayIntentBits, type Guild } from "discord.js";
import { GuildSyncService, PrismaGuildSyncRepository, type DiscordGuildSnapshot } from "./guild-sync.js";

const config = loadBotConfig();
const logger = createLogger({ service: "bot", level: config.logLevel });
const database = createDatabaseClient({ url: config.databaseUrl });
const guildSync = new GuildSyncService(new PrismaGuildSyncRepository(database));
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  allowedMentions: { parse: [], repliedUser: false },
});

function snapshotFromGuild(guild: Guild): DiscordGuildSnapshot {
  return {
    discordGuildId: guild.id,
    name: guild.name,
    iconUrl: guild.iconURL({ extension: "png", size: 128 }) ?? "",
    ownerDiscordUserId: guild.ownerId,
  };
}

async function closeRuntime(): Promise<void> {
  client.destroy();
  try {
    await database.$disconnect();
  } catch (error) {
    logger.error({ errorName: error instanceof Error ? error.name : "UnknownError" }, "Database disconnect failed");
    process.exitCode = 1;
  }
}

let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down Discord bot");
  await closeRuntime();
};

client.once(Events.ClientReady, (readyClient) => {
  void (async () => {
    logger.info({ botUserId: readyClient.user.id, guildCount: readyClient.guilds.cache.size }, "Discord gateway connected");
    const failures = await guildSync.syncMany([...readyClient.guilds.cache.values()].map(snapshotFromGuild));
    if (failures.length > 0) {
      logger.fatal({ failedGuildCount: failures.length, guildIds: failures.map((item) => item.discordGuildId) }, "Guild metadata synchronization failed");
      process.exitCode = 1;
      await closeRuntime();
      return;
    }
    logger.info({ syncedGuildCount: readyClient.guilds.cache.size }, "Guild metadata synchronized");
  })().catch(async (error: unknown) => {
    logger.fatal({ errorName: error instanceof Error ? error.name : "UnknownError" }, "Guild metadata synchronization failed");
    process.exitCode = 1;
    await closeRuntime();
  });
});

client.on(Events.GuildCreate, (guild) => {
  void guildSync.syncGuild(snapshotFromGuild(guild), { botJoinedAt: new Date() })
    .catch((error: unknown) => logger.error({ guildId: guild.id, errorName: error instanceof Error ? error.name : "UnknownError" }, "Guild metadata synchronization failed"));
});
client.on(Events.GuildUpdate, (_oldGuild, newGuild) => {
  void guildSync.syncGuild(snapshotFromGuild(newGuild))
    .catch((error: unknown) => logger.error({ guildId: newGuild.id, errorName: error instanceof Error ? error.name : "UnknownError" }, "Guild metadata synchronization failed"));
});
client.on(Events.GuildDelete, (guild) => {
  void guildSync.markGuildInactive(guild.id)
    .catch((error: unknown) => logger.error({ guildId: guild.id, errorName: error instanceof Error ? error.name : "UnknownError" }, "Guild deactivation sync failed"));
});
client.on(Events.Error, (error) => logger.error({ err: error }, "Discord client error"));

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await database.$connect();
  await client.login(config.discordToken);
} catch (error) {
  logger.fatal({ errorName: error instanceof Error ? error.name : "UnknownError" }, "Discord bot failed to start");
  await closeRuntime();
  process.exitCode = 1;
}
