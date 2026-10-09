import { Client, GatewayIntentBits } from 'discord.js';

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error('DISCORD_BOT_TOKEN is required to start the Discord bot.');
}

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
  client.destroy();
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

client.login(token).catch((error: unknown) => {
  console.error('Discord login failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
