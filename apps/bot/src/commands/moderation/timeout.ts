import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { VreeoCommand } from '../types.js';
import { auditReason, createModerationCase, finalizeModerationCase, invokerCanModerateTarget, parseReason, replyFailure } from './shared.js';

const maxTimeoutSeconds = 28 * 24 * 60 * 60;

export const timeoutCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Temporarily restrict a member from communicating.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Member to timeout.').setRequired(true))
    .addIntegerOption((option) => option.setName('duration').setDescription('Duration in seconds (60–2419200).').setMinValue(60).setMaxValue(maxTimeoutSeconds).setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the timeout.').setMaxLength(500).setRequired(false)),
  async execute(interaction) {
    if (!interaction.guild) return replyFailure(interaction, 'This command only works in a server.');
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) return replyFailure(interaction, 'You need the Moderate Members permission.');
    const target = interaction.options.getUser('user', true);
    const seconds = interaction.options.getInteger('duration', true);
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return replyFailure(interaction, 'That user is not a member of this server.');
    if (target.id === interaction.user.id) return replyFailure(interaction, 'You cannot timeout yourself.');
    if (!(await invokerCanModerateTarget(interaction, member))) return replyFailure(interaction, 'Your highest role must be above the target member’s highest role.');
    if (!member.moderatable) return replyFailure(interaction, 'Discord does not allow the bot to timeout that member. Check role hierarchy and bot permissions.');
    const reason = parseReason(interaction.options.getString('reason'));
    await interaction.deferReply({ ephemeral: true });
    let record;
    try {
      record = await createModerationCase({ guild: interaction.guild, interaction, targetDiscordUserId: target.id, action: 'timeout', reason, durationSeconds: seconds });
      await member.timeout(seconds * 1000, auditReason(record.caseNumber, interaction.user.tag, interaction.user.id, reason));
      await finalizeModerationCase(record.id, 'active');
      await interaction.editReply(`⏱️ ${target.tag} was timed out for ${Math.round(seconds / 60)} minute(s). Case #${record.caseNumber.toString()}.`);
    } catch (error) {
      if (record) await finalizeModerationCase(record.id, 'failed', error instanceof Error ? error.message : 'Unknown error').catch(() => undefined);
      console.error('Timeout command failed:', error instanceof Error ? error.message : 'Unknown error');
      await replyFailure(interaction, 'The timeout could not be completed. Check the bot permissions and try again.');
    }
  },
};
