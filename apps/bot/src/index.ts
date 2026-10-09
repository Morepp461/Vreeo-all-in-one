import "dotenv/config";
import { createDatabaseClient } from "@vreeo/database";
import { loadBotConfig } from "@vreeo/config";
import { createLogger } from "@vreeo/logger";
import { closeRedisConnection, consumeCooldown, createRedisConnection } from "@vreeo/redis";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { healthCommand } from "./commands/health.js";
import { CommandRegistry } from "./commands/registry.js";
import { BotInteractionRouter } from "./commands/router.js";
import { registerApplicationCommands } from "./commands/register.js";
import { markBotGuildLeft, syncBotGuild } from "./guild-registry.js";

const config = loadBotConfig();
const logger = createLogger({ service: "bot", level: config.logLevel });
const database = createDatabaseClient({ url: config.databaseUrl });
const redis = createRedisConnection({ url: config.redisUrl, logger });
const client = new Client({ intents: [GatewayIntentBits.Guilds], allowedMentions: { parse: [], repliedUser: false } });
const commands = new CommandRegistry([healthCommand]);
const interactionRouter = new BotInteractionRouter(commands, {
  logger,
  consumeCooldown: (keyParts, ttlMs) => consumeCooldown(redis, keyParts, ttlMs),
});
interactionRouter.attach(client);

async function syncKnownGuilds(): Promise<void> {
  const results = await Promise.allSettled([...client.guilds.cache.values()].map((guild) => syncBotGuild(database, guild)));
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) throw new Error(`Failed to sync ${failures.length} Discord guild record(s)`);
  logger.info({ guildCount: results.length }, "Discord guild registry synchronized");
}

let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down Discord bot");
  client.destroy();
  const results = await Promise.allSettled([database.$disconnect(), closeRedisConnection(redis)]);
  for (const result of results) {
    if (result.status === "rejected") {
      logger.error({ err: result.reason }, "Bot dependency shutdown failed");
      process.exitCode = 1;
    }
  }
};

client.once(Events.ClientReady, (readyClient) => {
  logger.info({ botUserId: readyClient.user.id, guildCount: readyClient.guilds.cache.size }, "Discord gateway connected");
  void Promise.all([
    syncKnownGuilds(),
    registerApplicationCommands(readyClient, commands, logger, config.discordDevGuildId),
  ]).catch((error) => {
    logger.fatal({ err: error }, "Bot startup synchronization failed");
    void shutdown("SIGTERM");
  });
});
client.on(Events.GuildCreate, (guild) => {
  void syncBotGuild(database, guild).catch((error) => logger.error({ err: error, guildId: guild.id }, "Failed to register Discord guild"));
});
client.on(Events.GuildDelete, (guild) => {
  void markBotGuildLeft(database, guild.id).catch((error) => logger.error({ err: error, guildId: guild.id }, "Failed to deactivate Discord guild"));
});
client.on(Events.Error, (error) => logger.error({ err: error }, "Discord client error"));
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await database.$connect();
  await redis.connect();
  await client.login(config.discordToken);
} catch (error) {
  logger.fatal({ err: error }, "Discord bot failed to start");
  client.destroy();
  await Promise.allSettled([database.$disconnect(), closeRedisConnection(redis)]);
  process.exitCode = 1;
}
