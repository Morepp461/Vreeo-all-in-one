import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { VreeoCommand } from './types.js';

export const serverInfoCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Show information about this Discord server.'),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        ephemeral: true,
      });
      return;
    }
    const owner = await guild.fetchOwner().catch(() => null);
    const embed = new EmbedBuilder()
      .setColor(0x9182ff)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
      .addFields(
        { name: 'Members', value: guild.memberCount.toLocaleString(), inline: true },
        {
          name: 'Created',
          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
          inline: true,
        },
        { name: 'Owner', value: owner ? `${owner.user.tag}` : 'Unavailable', inline: true },
        { name: 'Server ID', value: `\`${guild.id}\``, inline: false },
      )
      .setFooter({ text: 'VREEO • Server tools' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
