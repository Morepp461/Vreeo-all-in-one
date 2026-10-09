import { SlashCommandBuilder } from 'discord.js';
import type { VreeoCommand } from './types.js';

export const pingCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check VREEO bot latency and Discord API latency.'),
  async execute(interaction) {
    await interaction.reply({
      content: [
        '🏓 **VREEO is online**',
        `Gateway heartbeat: ${Math.round(interaction.client.ws.ping)} ms`,
        `Interaction round-trip: ${Date.now() - interaction.createdTimestamp} ms`,
      ].join('\n'),
      ephemeral: true,
    });
  },
};
