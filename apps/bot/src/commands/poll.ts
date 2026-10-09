import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { VreeoCommand } from './types.js';

export const pollCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a simple reaction-based poll.')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('Question for the poll.')
        .setMaxLength(240)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('option_a').setDescription('First option').setMaxLength(80).setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('option_b').setDescription('Second option').setMaxLength(80).setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('option_c')
        .setDescription('Optional third option')
        .setMaxLength(80)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('option_d')
        .setDescription('Optional fourth option')
        .setMaxLength(80)
        .setRequired(false),
    ),
  async execute(interaction) {
    if (!interaction.guild || !interaction.channel || !('send' in interaction.channel)) {
      await interaction.reply({
        content: 'Polls can only be created in a server text channel.',
        ephemeral: true,
      });
      return;
    }
    const question = interaction.options.getString('question', true);
    const options = [
      interaction.options.getString('option_a', true),
      interaction.options.getString('option_b', true),
      interaction.options.getString('option_c'),
      interaction.options.getString('option_d'),
    ].filter((value): value is string => Boolean(value?.trim()));
    if (new Set(options.map((value) => value.toLocaleLowerCase())).size !== options.length) {
      await interaction.reply({ content: 'Each poll option must be unique.', ephemeral: true });
      return;
    }
    const emoji = ['🇦', '🇧', '🇨', '🇩'];
    const embed = new EmbedBuilder()
      .setColor(0x9182ff)
      .setTitle('📊 ' + question)
      .setDescription(options.map((value, index) => `${emoji[index]}  ${value}`).join('\n'))
      .setFooter({ text: `Poll by ${interaction.user.tag} • VREEO` });
    await interaction.deferReply({ ephemeral: true });
    const message = await interaction.channel.send({ embeds: [embed] });
    for (let index = 0; index < options.length; index += 1) {
      const reactionEmoji = emoji[index];
      if (reactionEmoji) await message.react(reactionEmoji);
    }
    await interaction.editReply({ content: `Poll created: ${message.url}` });
  },
};
