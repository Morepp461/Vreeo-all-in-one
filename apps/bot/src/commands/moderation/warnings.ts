import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { prisma } from '@vreeo/database/client';
import type { VreeoCommand } from '../types.js';
import { replyFailure } from './shared.js';
import { syncGuild } from '../../services/guild-sync.js';

export const warningsCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Review recent warnings for a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Member to inspect.').setRequired(true)),
  async execute(interaction) {
    if (!interaction.guild) return replyFailure(interaction, 'This command only works in a server.');
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      return replyFailure(interaction, 'You need the Moderate Members permission.');
    }
    const target = interaction.options.getUser('user', true);
    const guild = await syncGuild(interaction.guild);
    const warnings = await prisma.warning.findMany({
      where: {
        guildId: guild.id,
        targetDiscordUserId: target.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        reason: true,
        moderatorDiscordUserId: true,
        createdAt: true,
        expiresAt: true,
        caseId: true,
      },
    });
    const embed = new EmbedBuilder()
      .setColor(0x9182ff)
      .setTitle(`Warnings · ${target.tag}`)
      .setDescription(
        warnings.length
          ? warnings.map((warning, index) => {
              const timestamp = Math.floor(warning.createdAt.getTime() / 1000);
              const caseText = warning.caseId ? ` · Case record linked` : '';
              return `**${index + 1}.** <t:${timestamp}:d> — ${warning.reason.slice(0, 300)}\nModerator: <@${warning.moderatorDiscordUserId}>${caseText}`;
            }).join('\n\n')
          : 'No active warnings were found for this member.',
      )
      .setFooter({ text: 'Showing up to 10 active warnings' });
    await interaction.reply({ embeds: [embed], ephemeral: true, allowedMentions: { parse: [] } });
  },
};
