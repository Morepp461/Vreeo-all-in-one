import { Client, Events, GatewayIntentBits } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN is missing. Copy .env.example to .env and configure it.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once(Events.ClientReady, (readyClient) => console.info(`VREEO bot connected as ${readyClient.user.tag}`));
client.on(Events.Error, (error) => console.error('Discord client error:', error));
await client.login(token);
