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

let shuttingDown = false;
let closePromise: Promise<void> | undefined;
function closeRuntime(reason?: string): Promise<void> {
  if (closePromise) return closePromise;
  shuttingDown = true;
  if (reason) logger.info({ reason }, "Shutting down Discord bot");
  closePromise = (async () => {
    client.destroy();
    try {
      await database.$disconnect();
    } catch (error) {
      logger.error({ errorName: error instanceof Error ? error.name : "UnknownError" }, "Database disconnect failed");
      process.exitCode = 1;
    }
  })();
  return closePromise;
}

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  await closeRuntime(signal);
};

client.once(Events.ClientReady, (readyClient) => {
  void (async () => {
    logger.info({ botUserId: readyClient.user.id, guildCount: readyClient.guilds.cache.size }, "Discord gateway connected");
    const failures = await guildSync.syncMany([...readyClient.guilds.cache.values()].map(snapshotFromGuild));
    if (failures.length > 0) {
      logger.fatal({ failedGuildCount: failures.length, guildIds: failures.map((item) => item.discordGuildId) }, "Guild metadata synchronization failed");
      process.exitCode = 1;
      await closeRuntime("guild_sync_failure");
      return;
    }
    logger.info({ syncedGuildCount: readyClient.guilds.cache.size }, "Guild metadata synchronized");
  })().catch(async (error: unknown) => {
    logger.fatal({ errorName: error instanceof Error ? error.name : "UnknownError" }, "Guild metadata synchronization failed");
    process.exitCode = 1;
    await closeRuntime("guild_sync_failure");
  });
});

client.on(Events.GuildCreate, (guild) => {
  if (shuttingDown) return;
  void guildSync.syncGuild(snapshotFromGuild(guild), { botJoinedAt: new Date() })
    .catch((error: unknown) => logger.error({ guildId: guild.id, errorName: error instanceof Error ? error.name : "UnknownError" }, "Guild metadata synchronization failed"));
});
client.on(Events.GuildUpdate, (_oldGuild, newGuild) => {
  if (shuttingDown) return;
  void guildSync.syncGuild(snapshotFromGuild(newGuild))
    .catch((error: unknown) => logger.error({ guildId: newGuild.id, errorName: error instanceof Error ? error.name : "UnknownError" }, "Guild metadata synchronization failed"));
});
client.on(Events.GuildDelete, (guild) => {
  if (shuttingDown) return;
  if (guild.available === false) {
    logger.warn({ guildId: guild.id }, "Discord guild is temporarily unavailable; preserving its active state");
    return;
  }
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
  await closeRuntime("startup_failure");
  process.exitCode = 1;
}
