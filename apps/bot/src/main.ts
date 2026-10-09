import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { getBotToken } from './config.js';

const token = getBotToken();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('clientReady', (readyClient) => {
  console.info(`Discord bot connected as ${readyClient.user.tag}`);
  // Command registration and interaction/event routers follow as dedicated slices.
});

client.on('error', (error) => {
  // Never log tokens or process environment values.
  console.error('Discord client error:', error.message);
});

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; shutting down Discord client.`);
  await client.destroy();
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

client.login(token).catch((error: unknown) => {
  console.error('Discord login failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
