import "dotenv/config";
import { createDatabaseClient } from "@vreeo/database";
import { loadBotConfig } from "@vreeo/config";
import { createLogger } from "@vreeo/logger";
import { closeRedisConnection, consumeCooldown, createRedisConnection } from "@vreeo/redis";
import { Client, GatewayIntentBits } from "discord.js";
import { healthCommand } from "./commands/health.js";
import { CommandRegistry } from "./commands/registry.js";
import { BotInteractionRouter } from "./commands/router.js";
import { BotEventRouter } from "./events/router.js";

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


const eventRouter = new BotEventRouter({
  client, database, logger, commands,
  ...(config.discordDevGuildId ? { developmentGuildId: config.discordDevGuildId } : {}),
  onFatal: () => { void shutdown("SIGTERM"); },
});
eventRouter.attach();

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
