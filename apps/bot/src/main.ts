import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { prisma } from '@vreeo/database/client';
import { commandMap } from './commands/index.js';
import { markGuildLeft, syncGuild } from './services/guild-sync.js';
import { getBotToken } from './config.js';
import { handleTicketPanelButton } from './services/ticket-panels.js';

const token = getBotToken();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.AutoModerationExecution],
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

client.on('autoModerationActionExecution', async (execution) => {
  try {
    const guild = await syncGuild(execution.guild);
    const metadata = {
      ruleId: execution.ruleId,
      channelId: execution.channelId,
      triggerType: execution.ruleTriggerType,
      matchedKeyword: execution.matchedKeyword,
    };
    await prisma.$transaction([
      prisma.securityEvent.create({
        data: {
          guildId: guild.id,
          eventType: 'automod_action',
          severity: 'medium',
          actorDiscordUserId: execution.userId,
          targetDiscordId: execution.userId,
          metadata,
        },
      }),
      prisma.auditLog.create({
        data: {
          guildId: guild.id,
          actorDiscordUserId: execution.userId,
          action: 'automod.action_executed',
          resourceType: 'automod_rule',
          resourceId: execution.ruleId,
          newValue: metadata,
          source: 'discord_bot',
        },
      }),
    ]);
  } catch (error) {
    console.error(
      'AutoMod execution logging failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('vreeo:ticket:create:')) {
      try {
        await handleTicketPanelButton(interaction);
      } catch (error) {
        console.error(
          'Ticket panel handler failed:',
          error instanceof Error ? error.message : 'Unknown error',
        );
        const payload = {
          content: 'VREEO could not process this ticket panel. Please try again later.',
          ephemeral: true,
        };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(payload).catch(() => undefined);
        } else {
          await interaction.reply(payload).catch(() => undefined);
        }
      }
    }
    return;
  }
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
