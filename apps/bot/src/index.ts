import "dotenv/config";
import { createDatabaseClient } from "@vreeo/database";
import { loadBotConfig } from "@vreeo/config";
import { createLogger } from "@vreeo/logger";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { markBotGuildLeft, syncBotGuild } from "./guild-registry.js";

const config = loadBotConfig();
const logger = createLogger({ service: "bot", level: config.logLevel });
const database = createDatabaseClient({ url: config.databaseUrl });
const client = new Client({ intents: [GatewayIntentBits.Guilds], allowedMentions: { parse: [], repliedUser: false } });

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
  try { await database.$disconnect(); }
  catch (error) { logger.error({ err: error }, "Database shutdown failed"); process.exitCode = 1; }
};
client.once(Events.ClientReady, () => {
  logger.info({ guildCount: client.guilds.cache.size }, "Discord gateway connected");
  void syncKnownGuilds().catch((error) => { logger.fatal({ err: error }, "Failed to synchronize Discord guild registry"); void shutdown("SIGTERM"); });
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
  await client.login(config.discordToken);
} catch (error) {
  logger.fatal({ err: error }, "Discord bot failed to start");
  client.destroy();
  await database.$disconnect().catch(() => undefined);
  process.exitCode = 1;
}
