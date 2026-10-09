import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { commandMap } from './commands/index.js';
import { markGuildLeft, syncGuild } from './services/guild-sync.js';
import { getBotToken } from './config.js';

const token = getBotToken();
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  allowedMentions: { parse: [], repliedUser: false },
});

client.once('clientReady', async (readyClient) => {
  console.info(`Discord bot connected as ${readyClient.user.tag}`);
  const guilds = [...readyClient.guilds.cache.values()];
  for (let index = 0; index < guilds.length; index += 10) {
    const batch = guilds.slice(index, index + 10);
    await Promise.all(
      batch.map((guild) =>
        syncGuild(guild).catch((error: unknown) => {
          console.error(
            'Guild sync failed:',
            error instanceof Error ? error.message : 'Unknown error',
          );
        }),
      ),
    );
  }
  console.info(`Guild synchronization completed for ${guilds.length} cached servers.`);
});

client.on('guildCreate', (guild) => {
  void syncGuild(guild).catch((error: unknown) => {
    console.error(
      'New guild sync failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
  });
});

client.on('guildDelete', (guild) => {
  void markGuildLeft(guild).catch((error: unknown) => {
    console.error(
      'Guild removal sync failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
  });
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commandMap.get(interaction.commandName);

  if (!command) {
    await interaction.reply({
      content: 'This command is not available in the current VREEO build.',
      ephemeral: true,
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(
      `Command /${interaction.commandName} failed:`,
      error instanceof Error ? error.message : 'Unknown error',
    );
    const payload = {
      content: 'Something went wrong while running that command. Please try again later.',
      ephemeral: true,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => undefined);
    } else {
      await interaction.reply(payload).catch(() => undefined);
    }
  }
});

client.on('error', (error) => {
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
