import { EmbedBuilder, SlashCommandBuilder, type User } from 'discord.js';
import type { VreeoCommand } from './types.js';

export const userInfoCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show information about a Discord user.')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to inspect.').setRequired(false),
    ),
  async execute(interaction) {
    const user: User = interaction.options.getUser('user') ?? interaction.user;
    const member = interaction.guild
      ? await interaction.guild.members.fetch(user.id).catch(() => null)
      : null;
    const embed = new EmbedBuilder()
      .setColor(0x9182ff)
      .setTitle(user.globalName ?? user.username)
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: 'Username', value: user.tag, inline: true },
        {
          name: 'Account created',
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
          inline: false,
        },
        {
          name: 'Joined server',
          value: member?.joinedTimestamp
            ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
            : 'Not a member / unavailable',
          inline: false,
        },
        { name: 'User ID', value: `\`${user.id}\``, inline: false },
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
