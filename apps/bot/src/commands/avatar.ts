import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { VreeoCommand } from './types.js';

export const avatarCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Display a Discord user avatar in full size.')
    .addUserOption((option) =>
      option.setName('user').setDescription('Whose avatar to display.').setRequired(false),
    ),
  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const url = user.displayAvatarURL({ size: 1024 });
    const embed = new EmbedBuilder()
      .setColor(0x9182ff)
      .setTitle(`${user.globalName ?? user.username}'s avatar`)
      .setImage(url)
      .setURL(url);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
