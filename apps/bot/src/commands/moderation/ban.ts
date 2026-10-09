import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { VreeoCommand } from '../types.js';
import { auditReason, createModerationCase, finalizeModerationCase, invokerCanModerateTarget, parseReason, replyFailure } from './shared.js';

export const banCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) => option.setName('user').setDescription('User to ban.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the ban.').setMaxLength(500).setRequired(false)),
  async execute(interaction) {
    if (!interaction.guild) return replyFailure(interaction, 'This command only works in a server.');
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) return replyFailure(interaction, 'You need the Ban Members permission.');
    const target = interaction.options.getUser('user', true);
    if (target.id === interaction.user.id) return replyFailure(interaction, 'You cannot ban yourself.');
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member && !(await invokerCanModerateTarget(interaction, member))) return replyFailure(interaction, 'Your highest role must be above the target member’s highest role.');
    if (member && !member.bannable) return replyFailure(interaction, 'Discord does not allow the bot to ban that member. Check role hierarchy and bot permissions.');
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) return replyFailure(interaction, 'The bot needs the Ban Members permission.');
    const reason = parseReason(interaction.options.getString('reason'));
    await interaction.deferReply({ ephemeral: true });
    let record;
    try {
      record = await createModerationCase({ guild: interaction.guild, interaction, targetDiscordUserId: target.id, action: 'ban', reason });
      await interaction.guild.members.ban(target.id, { reason: auditReason(record.caseNumber, interaction.user.tag, interaction.user.id, reason) });
      await finalizeModerationCase(record.id, 'active');
      await interaction.editReply(`🔨 ${target.tag} was banned. Case #${record.caseNumber.toString()}.`);
    } catch (error) {
      if (record) await finalizeModerationCase(record.id, 'failed', error instanceof Error ? error.message : 'Unknown error').catch(() => undefined);
      console.error('Ban command failed:', error instanceof Error ? error.message : 'Unknown error');
      await replyFailure(interaction, 'The ban could not be completed. Check the bot permissions and try again.');
    }
  },
};
