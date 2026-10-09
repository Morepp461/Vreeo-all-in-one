import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { VreeoCommand } from '../types.js';
import { auditReason, createModerationCase, finalizeModerationCase, parseReason, replyFailure } from './shared.js';

export const kickCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Remove a member from this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) => option.setName('user').setDescription('Member to kick.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the kick.').setMaxLength(500).setRequired(false)),
  async execute(interaction) {
    if (!interaction.guild) return replyFailure(interaction, 'This command only works in a server.');
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) return replyFailure(interaction, 'You need the Kick Members permission.');
    const target = interaction.options.getUser('user', true);
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return replyFailure(interaction, 'That user is not a member of this server.');
    if (target.id === interaction.user.id || target.bot) return replyFailure(interaction, 'You cannot kick yourself or a bot account.');
    if (!member.kickable) return replyFailure(interaction, 'Discord does not allow the bot to kick that member. Check role hierarchy and bot permissions.');
    const reason = parseReason(interaction.options.getString('reason'));
    await interaction.deferReply({ ephemeral: true });
    let record;
    try {
      record = await createModerationCase({ guild: interaction.guild, interaction, targetDiscordUserId: target.id, action: 'kick', reason });
      await member.kick(auditReason(record.caseNumber, interaction.user.tag, interaction.user.id, reason));
      await finalizeModerationCase(record.id, 'active');
      await interaction.editReply(`👢 ${target.tag} was kicked. Case #${record.caseNumber.toString()}.`);
    } catch (error) {
      if (record) await finalizeModerationCase(record.id, 'failed', error instanceof Error ? error.message : 'Unknown error').catch(() => undefined);
      console.error('Kick command failed:', error instanceof Error ? error.message : 'Unknown error');
      await replyFailure(interaction, 'The kick could not be completed. Check the bot permissions and try again.');
    }
  },
};
