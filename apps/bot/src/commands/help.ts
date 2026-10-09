import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { VreeoCommand } from './types.js';

export const helpCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available VREEO commands and platform information.'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x9182ff)
      .setTitle('VREEO · Command Center')
      .setDescription(
        'Discord community management, designed to work alongside the VREEO dashboard.',
      )
      .addFields(
        {
          name: 'General',
          value: '`/help` — show this guide\n`/ping` — check bot latency',
        },
        {
          name: 'Server tools',
          value:
            '`/serverinfo` — view server information\n`/userinfo` — view a member profile\n`/avatar` — view a member avatar\n`/poll` — create a reaction-based poll',
        },
        {
          name: 'Moderation',
          value:
            '`/warn` — issue a warning\n`/timeout` — temporarily restrict a member\n`/kick` — remove a member\n`/ban` — ban a user\n`/case` — view a case\n`/warnings` — view warning history\n`/automod` — manage keyword filters',
        },
      )
      .setFooter({ text: 'VREEO • AI is not part of V1' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
