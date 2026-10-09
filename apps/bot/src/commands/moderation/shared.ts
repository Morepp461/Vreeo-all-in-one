import type { ChatInputCommandInteraction, Guild } from 'discord.js';
import { prisma } from '@vreeo/database/client';
import { syncGuild } from '../../services/guild-sync.js';

export async function createModerationCase(input: {
  guild: Guild;
  interaction: ChatInputCommandInteraction;
  targetDiscordUserId: string;
  action: 'warn' | 'timeout' | 'kick' | 'ban';
  reason: string;
  durationSeconds?: number;
}) {
  const guildRecord = await syncGuild(input.guild);
  return prisma.$transaction(async (tx) => {
    // Serialize case-number allocation per guild to prevent duplicate numbers under concurrent commands.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${guildRecord.id}))`;
    const latest = await tx.moderationCase.aggregate({
      where: { guildId: guildRecord.id },
      _max: { caseNumber: true },
    });
    const caseNumber = (latest._max.caseNumber ?? 0n) + 1n;
    const durationSeconds = input.durationSeconds;
    const expiresAt = durationSeconds
      ? new Date(Date.now() + durationSeconds * 1000)
      : null;

    const moderationCase = await tx.moderationCase.create({
      data: {
        guildId: guildRecord.id,
        caseNumber,
        targetDiscordUserId: input.targetDiscordUserId,
        moderatorDiscordUserId: input.interaction.user.id,
        action: input.action,
        reason: input.reason,
        durationSeconds: durationSeconds ? BigInt(durationSeconds) : null,
        expiresAt,
        status: 'pending',
      },
      select: { id: true, caseNumber: true },
    });

    if (input.action === 'warn') {
      await tx.warning.create({
        data: {
          guildId: guildRecord.id,
          targetDiscordUserId: input.targetDiscordUserId,
          moderatorDiscordUserId: input.interaction.user.id,
          reason: input.reason,
          caseId: moderationCase.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        guildId: guildRecord.id,
        actorDiscordUserId: input.interaction.user.id,
        action: `moderation.${input.action}.pending`,
        resourceType: 'moderation_case',
        resourceId: moderationCase.id,
        newValue: {
          caseNumber: caseNumber.toString(),
          targetDiscordUserId: input.targetDiscordUserId,
          reason: input.reason,
          durationSeconds: durationSeconds ?? null,
        },
        source: 'discord_bot',
      },
    });

    return moderationCase;
  });
}

export async function finalizeModerationCase(
  caseId: string,
  status: 'active' | 'failed',
  errorMessage?: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.moderationCase.update({
      where: { id: caseId },
      data: { status },
    });
    await tx.auditLog.create({
      data: {
        action: `moderation.case.${status}`,
        resourceType: 'moderation_case',
        resourceId: caseId,
        newValue: errorMessage ? { error: errorMessage.slice(0, 200) } : { status },
        source: 'discord_bot',
      },
    });
  });
}

export function parseReason(value: string | null): string {
  const reason = value?.trim();
  return reason && reason.length >= 3 ? reason.slice(0, 500) : 'No reason provided';
}

export function auditReason(caseNumber: bigint, actorTag: string, actorId: string, reason: string) {
  return `VREEO case #${caseNumber} • ${actorTag} (${actorId}): ${reason}`.slice(0, 512);
}

export function replyFailure(interaction: ChatInputCommandInteraction, message: string) {
  if (interaction.deferred || interaction.replied) {
    return interaction.followUp({ content: message, ephemeral: true, allowedMentions: { parse: [] } });
  }
  return interaction.reply({ content: message, ephemeral: true, allowedMentions: { parse: [] } });
}
