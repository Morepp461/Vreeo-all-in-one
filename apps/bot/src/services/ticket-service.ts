import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
} from 'discord.js';
import { prisma } from '@vreeo/database/client';

export type TicketSettings = {
  enabled: boolean;
  ticketCategoryId: string | null;
  staffRoleId: string | null;
};

export type TicketCreationResult = {
  status: string;
  ticketNumber: bigint;
  channelId: string | null;
  existing: boolean;
};

export class TicketCreationInProgressError extends Error {
  constructor() {
    super('A ticket request with this interaction ID is already being processed.');
    this.name = 'TicketCreationInProgressError';
  }
}

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function readTicketSettings(configValue: unknown, enabled = false): TicketSettings {
  const config = readObject(configValue);
  const category = config.ticketCategoryId;
  const staffRole = config.ticketStaffRoleId;
  return {
    enabled,
    ticketCategoryId:
      typeof category === 'string' && /^\d{17,20}$/.test(category) ? category : null,
    staffRoleId:
      typeof staffRole === 'string' && /^\d{17,20}$/.test(staffRole) ? staffRole : null,
  };
}

export async function loadTicketSettings(guildId: string): Promise<TicketSettings> {
  const feature = await prisma.guildFeature.findUnique({
    where: { guildId_featureKey: { guildId, featureKey: 'tickets' } },
    select: { config: true, enabled: true },
  });
  return readTicketSettings(feature?.config, feature?.enabled ?? false);
}

async function findExistingRequest(interactionId: string): Promise<TicketCreationResult | null> {
  const existing = await prisma.ticket.findUnique({
    where: { sourceInteractionId: interactionId },
    select: { ticketNumber: true, channelDiscordId: true, status: true },
  });
  if (!existing) return null;
  return {
    status: existing.status,
    ticketNumber: existing.ticketNumber,
    channelId: existing.channelDiscordId,
    existing: true,
  };
}

export async function createTicketChannel(input: {
  guild: Guild;
  guildRecordId: string;
  userId: string;
  interactionId: string;
  subject: string;
  categoryId: string;
  staffRoleId: string | null;
  botUserId: string;
}): Promise<TicketCreationResult> {
  const existing = await findExistingRequest(input.interactionId);
  if (existing) return existing;

  let ticket: { id: string; ticketNumber: bigint } | null = null;
  let channelId: string | null = null;
  try {
    ticket = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.guildRecordId}))`;
      const latest = await tx.ticket.aggregate({
        where: { guildId: input.guildRecordId },
        _max: { ticketNumber: true },
      });
      const ticketNumber = (latest._max.ticketNumber ?? 0n) + 1n;
      const created = await tx.ticket.create({
        data: {
          guildId: input.guildRecordId,
          ticketNumber,
          sourceInteractionId: input.interactionId,
          openerDiscordUserId: input.userId,
          subject: input.subject,
          status: 'creating',
        },
        select: { id: true, ticketNumber: true },
      });
      await tx.auditLog.create({
        data: {
          guildId: input.guildRecordId,
          actorDiscordUserId: input.userId,
          action: 'ticket.creation.started',
          resourceType: 'ticket',
          resourceId: created.id,
          newValue: { ticketNumber: ticketNumber.toString(), subject: input.subject },
          source: 'discord_bot',
        },
      });
      return created;
    });

    const overwrites = [
      { id: input.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: input.userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
      {
        id: input.botUserId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      },
      ...(input.staffRoleId
        ? [{
            id: input.staffRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          }]
        : []),
    ];

    const channel = await input.guild.channels.create({
      name: `ticket-${ticket.ticketNumber.toString().padStart(4, '0')}`,
      type: ChannelType.GuildText,
      parent: input.categoryId,
      topic: `VREEO ticket #${ticket.ticketNumber.toString()} • Opener: ${input.userId} • Subject: ${input.subject}`.slice(0, 1024),
      permissionOverwrites: overwrites,
      reason: `VREEO ticket #${ticket.ticketNumber.toString()} opened by ${input.userId}`,
    });
    channelId = channel.id;

    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { channelDiscordId: channel.id, status: 'open' },
      }),
      prisma.auditLog.create({
        data: {
          guildId: input.guildRecordId,
          actorDiscordUserId: input.userId,
          action: 'ticket.opened',
          resourceType: 'ticket',
          resourceId: ticket.id,
          newValue: { channelDiscordId: channel.id, status: 'open' },
          source: 'discord_bot',
        },
      }),
    ]);

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x9182ff)
          .setTitle(`Ticket #${ticket.ticketNumber.toString()}`)
          .setDescription(input.subject)
          .addFields({ name: 'Opened by', value: `<@${input.userId}>`, inline: true })
          .setFooter({ text: 'VREEO Support • Use /ticket close when finished' }),
      ],
      allowedMentions: { parse: [] },
    });

    return {
      status: 'open',
      ticketNumber: ticket.ticketNumber,
      channelId: channel.id,
      existing: false,
    };
  } catch (error) {
    if (!ticket) {
      const existingRequest = await findExistingRequest(input.interactionId).catch(() => null);
      if (existingRequest) return existingRequest;
    }
    if (channelId) {
      await input.guild.channels
        .delete(channelId, 'VREEO ticket persistence failed')
        .catch((rollbackError: unknown) => {
          console.error(
            'Ticket channel rollback failed:',
            rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
          );
        });
    }
    if (ticket) {
      await prisma.ticket
        .update({
          where: { id: ticket.id },
          data: {
            status: 'failed',
            closedAt: new Date(),
            closeReason: 'Ticket channel creation failed.',
          },
        })
        .catch(() => undefined);
      await prisma.auditLog
        .create({
          data: {
            guildId: input.guildRecordId,
            actorDiscordUserId: input.userId,
            action: 'ticket.creation.failed',
            resourceType: 'ticket',
            resourceId: ticket.id,
            newValue: {
              error: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error',
            },
            source: 'discord_bot',
          },
        })
        .catch(() => undefined);
    }
    throw error;
  }
}
