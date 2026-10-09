import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { VreeoCommand } from '../types.js';
import { createModerationCase, finalizeModerationCase, invokerCanModerateTarget, parseReason, replyFailure } from './shared.js';

export const warnCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue and record a moderation warning.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Member to warn.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the warning.').setMaxLength(500).setRequired(false)),
  async execute(interaction) {
    if (!interaction.guild) return replyFailure(interaction, 'This command only works in a server.');
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) return replyFailure(interaction, 'You need the Moderate Members permission.');
    const target = interaction.options.getUser('user', true);
    if (target.id === interaction.user.id) return replyFailure(interaction, 'You cannot warn yourself.');
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return replyFailure(interaction, 'That user is not a member of this server.');
    if (!(await invokerCanModerateTarget(interaction, member))) return replyFailure(interaction, 'Your highest role must be above the target member’s highest role.');
    const reason = parseReason(interaction.options.getString('reason'));
    await interaction.deferReply({ ephemeral: true });
    let record;
    try {
      record = await createModerationCase({ guild: interaction.guild, interaction, targetDiscordUserId: target.id, action: 'warn', reason });
      await target.send({ content: `You received a warning in **${interaction.guild.name}**.\nReason: ${reason}`, allowedMentions: { parse: [] } }).catch(() => null);
      await finalizeModerationCase(record.id, 'active');
      await interaction.editReply(`⚠️ **Warning recorded** · Case #${record.caseNumber.toString()} for ${target.tag}.\nReason: ${reason}`);
    } catch (error) {
      if (record) await finalizeModerationCase(record.id, 'failed', error instanceof Error ? error.message : 'Unknown error').catch(() => undefined);
      console.error('Warning command failed:', error instanceof Error ? error.message : 'Unknown error');
      await replyFailure(interaction, 'The warning could not be recorded. No further action was taken.');
    }
  },
};
