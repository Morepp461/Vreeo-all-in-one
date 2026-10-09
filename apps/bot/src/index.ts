import "dotenv/config";
import { loadBotConfig } from "@vreeo/config";
import { createLogger } from "@vreeo/logger";
import { Client, Events, GatewayIntentBits } from "discord.js";

const config = loadBotConfig();
const logger = createLogger({ service: "bot", level: config.logLevel });
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  allowedMentions: { parse: [], repliedUser: false },
});

client.once(Events.ClientReady, (readyClient) => {
  logger.info({ botUserId: readyClient.user.id, guildCount: readyClient.guilds.cache.size }, "Discord gateway connected");
});
client.on(Events.Error, (error) => logger.error({ err: error }, "Discord client error"));

let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down Discord bot");
  client.destroy();
};
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await client.login(config.discordToken);
} catch (error) {
  logger.fatal({ err: error }, "Discord bot failed to log in");
  client.destroy();
  process.exitCode = 1;
}
