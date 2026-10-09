import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { prisma } from '@vreeo/database/client';
import type { VreeoCommand } from '../types.js';
import { replyFailure } from './shared.js';
import { syncGuild } from '../../services/guild-sync.js';

export const caseCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('View a moderation case from this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption((option) =>
      option
        .setName('case_number')
        .setDescription('Case number to look up.')
        .setMinLength(1)
        .setMaxLength(18)
        .setRequired(true),
    ),
  async execute(interaction) {
    if (!interaction.guild) return replyFailure(interaction, 'This command only works in a server.');
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      return replyFailure(interaction, 'You need the Moderate Members permission.');
    }
    const rawNumber = interaction.options.getString('case_number', true).trim();
    if (!/^\d{1,18}$/.test(rawNumber) || BigInt(rawNumber) < 1n) {
      return replyFailure(interaction, 'Enter a valid positive case number.');
    }

    const guild = await syncGuild(interaction.guild);
    const record = await prisma.moderationCase.findFirst({
      where: { guildId: guild.id, caseNumber: BigInt(rawNumber) },
      select: {
        caseNumber: true,
        targetDiscordUserId: true,
        moderatorDiscordUserId: true,
        action: true,
        reason: true,
        status: true,
        durationSeconds: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    if (!record) return replyFailure(interaction, 'No moderation case with that number was found in this server.');

    const embed = new EmbedBuilder()
      .setColor(record.status === 'failed' ? 0xe06c75 : 0x9182ff)
      .setTitle(`Moderation case #${record.caseNumber.toString()}`)
      .addFields(
        { name: 'Action', value: record.action.toUpperCase(), inline: true },
        { name: 'Status', value: record.status.toUpperCase(), inline: true },
        { name: 'Created', value: `<t:${Math.floor(record.createdAt.getTime() / 1000)}:F>`, inline: false },
        { name: 'Target', value: `<@${record.targetDiscordUserId}> (\`${record.targetDiscordUserId}\`)`, inline: false },
        { name: 'Moderator', value: `<@${record.moderatorDiscordUserId}>`, inline: true },
        { name: 'Reason', value: record.reason.slice(0, 1024), inline: false },
      );
    if (record.durationSeconds !== null) {
      embed.addFields({ name: 'Duration', value: `${record.durationSeconds.toString()} seconds`, inline: true });
    }
    if (record.expiresAt) {
      embed.addFields({ name: 'Expires', value: `<t:${Math.floor(record.expiresAt.getTime() / 1000)}:F>`, inline: true });
    }
    await interaction.reply({ embeds: [embed], ephemeral: true, allowedMentions: { parse: [] } });
  },
};
