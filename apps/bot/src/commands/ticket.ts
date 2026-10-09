import { ChannelType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { prisma } from '@vreeo/database/client';
import type { VreeoCommand } from './types.js';
import { syncGuild } from '../services/guild-sync.js';
import { replyFailure } from './moderation/shared.js';
import {
  createTicketChannel,
  loadTicketSettings,
  readTicketSettings,
} from '../services/ticket-service.js';

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function isStaff(interaction: Parameters<VreeoCommand['execute']>[0], staffRoleId: string | null) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  if (!staffRoleId || !interaction.inGuild()) return false;
  const member = interaction.member;
  if (!member || !('roles' in member) || !member.roles) return false;
  const roles = member.roles;
  if (Array.isArray(roles)) return roles.includes(staffRoleId);
  if ('cache' in roles) return roles.cache.has(staffRoleId);
  return false;
}

async function writeTicketAudit(input: {
  guildId: string;
  actorId: string;
  action: string;
  ticketId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      guildId: input.guildId,
      actorDiscordUserId: input.actorId,
      action: input.action,
      resourceType: 'ticket',
      resourceId: input.ticketId,
      ...(input.oldValue ? { oldValue: JSON.parse(JSON.stringify(input.oldValue)) } : {}),
      ...(input.newValue ? { newValue: JSON.parse(JSON.stringify(input.newValue)) } : {}),
      source: 'discord_bot',
    },
  });
}

function ticketFailure(interaction: Parameters<VreeoCommand['execute']>[0], message: string) {
  if (interaction.deferred && !interaction.replied) {
    return interaction.editReply({ content: message, allowedMentions: { parse: [] } });
  }
  return replyFailure(interaction, message);
}

export const ticketCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Open and manage private support tickets.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Configure the ticket category and optional staff role.')
        .addChannelOption((option) =>
          option
            .setName('category')
            .setDescription('Category where new ticket channels will be created.')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        )
        .addRoleOption((option) =>
          option
            .setName('staff_role')
            .setDescription('Optional role that can view and manage tickets.')
            .setRequired(false),
        )
        .addBooleanOption((option) =>
          option
            .setName('clear_staff_role')
            .setDescription('Remove the currently configured ticket staff role.')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('open')
        .setDescription('Open a private support ticket.')
        .addStringOption((option) =>
          option
            .setName('subject')
            .setDescription('Brief reason for opening this ticket.')
            .setMinLength(3)
            .setMaxLength(200)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('claim').setDescription('Claim the ticket in the current channel.'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('close')
        .setDescription('Close and archive the ticket in the current channel.')
        .addStringOption((option) =>
          option
            .setName('reason')
            .setDescription('Optional reason for closing.')
            .setMaxLength(500)
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('reopen').setDescription('Reopen a closed ticket in the current channel.'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List the latest active tickets (staff only).'),
    ),
  async execute(interaction) {
    if (!interaction.guild) {
      return ticketFailure(interaction, 'This command only works in a server.');
    }

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const guildRecord = await syncGuild(guild);

    if (subcommand === 'setup') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return ticketFailure(
          interaction,
          'You need the Manage Server permission to configure tickets.',
        );
      }
      if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return ticketFailure(
          interaction,
          'VREEO needs the Manage Channels permission to configure tickets.',
        );
      }

      const category = interaction.options.getChannel('category', true);
      if (category.type !== ChannelType.GuildCategory) {
        return ticketFailure(interaction, 'Choose a category from this server.');
      }
      const staffRole = interaction.options.getRole('staff_role');
      if (staffRole && staffRole.id === guild.id) {
        return ticketFailure(
          interaction,
          'The @everyone role cannot be used as the ticket staff role.',
        );
      }

      try {
        const current = await prisma.guildFeature.findUnique({
          where: { guildId_featureKey: { guildId: guildRecord.id, featureKey: 'tickets' } },
          select: { config: true },
        });
        const currentSettings = readTicketSettings(current?.config);
        const clearStaffRole = interaction.options.getBoolean('clear_staff_role') ?? false;
        if (staffRole && clearStaffRole) {
          await interaction.editReply('Choose a staff role or clear the existing one, not both.');
          return;
        }
        const nextStaffRoleId =
          staffRole?.id ?? (clearStaffRole ? null : currentSettings.staffRoleId);
        const config = JSON.parse(
          JSON.stringify({
            ...readObject(current?.config),
            ticketCategoryId: category.id,
            ticketStaffRoleId: nextStaffRoleId,
          }),
        );
        await prisma.guildFeature.upsert({
          where: { guildId_featureKey: { guildId: guildRecord.id, featureKey: 'tickets' } },
          create: {
            guildId: guildRecord.id,
            featureKey: 'tickets',
            enabled: true,
            config,
          },
          update: { enabled: true, config },
        });
        await writeTicketAudit({
          guildId: guildRecord.id,
          actorId: interaction.user.id,
          action: 'ticket.settings.updated',
          ticketId: guildRecord.id,
          newValue: {
            ticketCategoryId: category.id,
            staffRoleId: nextStaffRoleId,
          },
        });
        await interaction.editReply(
          `Ticket category set to **${category.name}**${nextStaffRoleId ? ` and staff role set to <@&${nextStaffRoleId}>` : ''}.`,
        );
      } catch (error) {
        console.error(
          'Ticket setup failed:',
          error instanceof Error ? error.message : 'Unknown error',
        );
        await ticketFailure(
          interaction,
          'Ticket setup failed. Please check the bot permissions and try again.',
        );
      }
      return;
    }

    if (subcommand === 'open') {
      const botMember = guild.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return ticketFailure(
          interaction,
          'VREEO needs the Manage Channels permission to open tickets.',
        );
      }
      const subject = interaction.options.getString('subject', true).trim();
      if (subject.length < 3) {
        return ticketFailure(interaction, 'The ticket subject must contain at least 3 characters.');
      }

      const settings = await loadTicketSettings(guildRecord.id);
      if (!settings.enabled) {
        return ticketFailure(
          interaction,
          'Tickets are disabled or not configured yet. Ask a server administrator to run /ticket setup.',
        );
      }
      if (!settings.ticketCategoryId) {
        return ticketFailure(
          interaction,
          'Tickets are not configured yet. Ask a server administrator to run /ticket setup.',
        );
      }
      const category = await guild.channels.fetch(settings.ticketCategoryId).catch(() => null);
      if (
        !category ||
        category.type !== ChannelType.GuildCategory ||
        category.guildId !== guild.id
      ) {
        return ticketFailure(
          interaction,
          'The configured ticket category no longer exists. Ask an administrator to run /ticket setup again.',
        );
      }
      if (settings.staffRoleId && !guild.roles.cache.has(settings.staffRoleId)) {
        return ticketFailure(
          interaction,
          'The configured ticket staff role no longer exists. Ask an administrator to run /ticket setup again.',
        );
      }

      try {
        const result = await createTicketChannel({
          guild,
          guildRecordId: guildRecord.id,
          userId: interaction.user.id,
          interactionId: interaction.id,
          subject,
          categoryId: category.id,
          staffRoleId: settings.staffRoleId,
          botUserId: botMember.id,
        });
        if (result.status === 'failed') {
          return ticketFailure(
            interaction,
            'This ticket request already failed. Please start a new ticket request.',
          );
        }
        if (result.existing) {
          if (result.channelId) {
            await interaction.editReply({
              content: `This ticket request was already processed: <#${result.channelId}>.`,
              allowedMentions: { parse: [] },
            });
          } else {
            await interaction.editReply({
              content: 'This ticket request is already being processed. Please wait a moment.',
              allowedMentions: { parse: [] },
            });
          }
          return;
        }
        if (!result.channelId) {
          return ticketFailure(
            interaction,
            'VREEO created the ticket record but could not confirm its channel. Ask an administrator to reconcile it.',
          );
        }
        await interaction.editReply({
          content: `Your ticket has been opened: <#${result.channelId}>`,
          allowedMentions: { parse: [] },
        });
      } catch (error) {
        console.error(
          'Ticket creation failed:',
          error instanceof Error ? error.message : 'Unknown error',
        );
        return ticketFailure(
          interaction,
          'VREEO could not create the ticket. Check channel permissions and try again.',
        );
      }
      return;
    }

    const settings = await loadTicketSettings(guildRecord.id);
    const isTicketStaff = isStaff(interaction, settings.staffRoleId);

    if (subcommand === 'list') {
      if (!isTicketStaff)
        return ticketFailure(
          interaction,
          'Only configured ticket staff or members with Manage Channels can list tickets.',
        );
      const tickets = await prisma.ticket.findMany({
        where: { guildId: guildRecord.id, status: { in: ['open', 'claimed'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          ticketNumber: true,
          channelDiscordId: true,
          openerDiscordUserId: true,
          claimedByDiscordUserId: true,
          status: true,
          subject: true,
          createdAt: true,
        },
      });
      const embed = new EmbedBuilder()
        .setColor(0x9182ff)
        .setTitle('VREEO · Active tickets')
        .setDescription(
          tickets.length
            ? tickets
                .map(
                  (item) =>
                    `**#${item.ticketNumber.toString()}** · ${item.status === 'claimed' ? `Claimed by <@${item.claimedByDiscordUserId}>` : 'Open'}\nOpener: <@${item.openerDiscordUserId}> · ${item.subject ?? 'No subject'}\n${item.channelDiscordId ? `<#${item.channelDiscordId}>` : 'Channel pending'}`,
                )
                .join('\n\n')
            : 'There are no active tickets.',
        )
        .setFooter({ text: 'Showing up to 10 active tickets' });
      await interaction.editReply({
        embeds: [embed],
        allowedMentions: { parse: [] },
      });
      return;
    }

    const currentChannelId = interaction.channelId;
    const ticket = await prisma.ticket.findUnique({
      where: {
        guildId_channelDiscordId: { guildId: guildRecord.id, channelDiscordId: currentChannelId },
      },
      select: {
        id: true,
        ticketNumber: true,
        channelDiscordId: true,
        openerDiscordUserId: true,
        claimedByDiscordUserId: true,
        status: true,
        subject: true,
        closeReason: true,
        updatedAt: true,
      },
    });
    if (!ticket || !ticket.channelDiscordId) {
      return ticketFailure(interaction, 'This command must be used inside a VREEO ticket channel.');
    }
    const channel = await guild.channels.fetch(ticket.channelDiscordId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return ticketFailure(
        interaction,
        'The ticket channel is missing or is not a text channel. An administrator may need to reconcile this ticket.',
      );
    }

    if (subcommand === 'claim') {
      if (!isTicketStaff)
        return ticketFailure(
          interaction,
          'Only configured ticket staff or members with Manage Channels can claim tickets.',
        );
      if (!['open', 'claimed'].includes(ticket.status))
        return ticketFailure(interaction, 'Only active tickets can be claimed.');
      if (ticket.claimedByDiscordUserId && ticket.claimedByDiscordUserId !== interaction.user.id) {
        return ticketFailure(
          interaction,
          `This ticket is already claimed by <@${ticket.claimedByDiscordUserId}>.`,
        );
      }
      const claimed = await prisma.$transaction(async (tx) => {
        const result = await tx.ticket.updateMany({
          where: {
            id: ticket.id,
            status: { in: ['open', 'claimed'] },
            OR: [{ claimedByDiscordUserId: null }, { claimedByDiscordUserId: interaction.user.id }],
          },
          data: { status: 'claimed', claimedByDiscordUserId: interaction.user.id },
        });
        if (result.count !== 1) return false;
        await tx.auditLog.create({
          data: {
            guildId: guildRecord.id,
            actorDiscordUserId: interaction.user.id,
            action: 'ticket.claimed',
            resourceType: 'ticket',
            resourceId: ticket.id,
            oldValue: { claimedByDiscordUserId: ticket.claimedByDiscordUserId },
            newValue: { claimedByDiscordUserId: interaction.user.id, status: 'claimed' },
            source: 'discord_bot',
          },
        });
        return true;
      });
      if (!claimed) {
        return ticketFailure(
          interaction,
          'Another staff member claimed this ticket first. Refresh and try again.',
        );
      }
      await interaction.editReply({
        content: `Ticket #${ticket.ticketNumber.toString()} claimed by <@${interaction.user.id}>`,
        allowedMentions: { parse: [] },
      });
      await channel.send({
        content: `This ticket is now being handled by <@${interaction.user.id}>.`,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (subcommand === 'close') {
      const isOpener = interaction.user.id === ticket.openerDiscordUserId;
      if (!isOpener && !isTicketStaff) {
        return ticketFailure(
          interaction,
          'Only the ticket opener or ticket staff can close this ticket.',
        );
      }
      if (!['open', 'claimed', 'closing'].includes(ticket.status)) {
        return ticketFailure(interaction, 'This ticket is already closed.');
      }

      const reason =
        interaction.options.getString('reason')?.trim().slice(0, 500) || 'No reason provided';
      const previousStatus =
        ticket.status === 'closing'
          ? ticket.claimedByDiscordUserId
            ? 'claimed'
            : 'open'
          : ticket.status;
      const closedAt = new Date();
      const staleTransitionBefore = new Date(Date.now() - 2 * 60 * 1000);
      if (ticket.status === 'closing') {
        if (ticket.updatedAt > staleTransitionBefore) {
          return ticketFailure(
            interaction,
            'A ticket close operation is already in progress. Try again in a moment.',
          );
        }
        const recovery = await prisma.ticket.updateMany({
          where: {
            id: ticket.id,
            status: 'closing',
            updatedAt: { lt: staleTransitionBefore },
          },
          data: { status: 'closing', updatedAt: new Date() },
        });
        if (recovery.count !== 1) {
          return ticketFailure(
            interaction,
            'Another ticket action is already in progress. Try again.',
          );
        }
      } else {
        const transition = await prisma.ticket.updateMany({
          where: { id: ticket.id, status: { in: ['open', 'claimed'] } },
          data: { status: 'closing' },
        });
        if (transition.count !== 1) {
          return ticketFailure(
            interaction,
            'Another ticket action is already in progress. Try again.',
          );
        }
      }

      const previousOverwrite = channel.permissionOverwrites.cache.get(ticket.openerDiscordUserId);
      const previousSendMessages = previousOverwrite?.allow.has(PermissionFlagsBits.SendMessages)
        ? true
        : previousOverwrite?.deny.has(PermissionFlagsBits.SendMessages)
          ? false
          : null;
      const previousAddReactions = previousOverwrite?.allow.has(PermissionFlagsBits.AddReactions)
        ? true
        : previousOverwrite?.deny.has(PermissionFlagsBits.AddReactions)
          ? false
          : null;
      const previousChannelName = channel.name;

      try {
        await channel.permissionOverwrites.edit(ticket.openerDiscordUserId, {
          ViewChannel: true,
          ReadMessageHistory: true,
          SendMessages: false,
          AddReactions: false,
        });
        await channel.setName(`closed-ticket-${ticket.ticketNumber.toString().padStart(4, '0')}`);
        await prisma.$transaction([
          prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: 'closed', closeReason: reason, closedAt },
          }),
          prisma.auditLog.create({
            data: {
              guildId: guildRecord.id,
              actorDiscordUserId: interaction.user.id,
              action: 'ticket.closed',
              resourceType: 'ticket',
              resourceId: ticket.id,
              oldValue: { status: previousStatus },
              newValue: { status: 'closed', reason, closedAt: closedAt.toISOString() },
              source: 'discord_bot',
            },
          }),
        ]);
      } catch (error) {
        await channel.permissionOverwrites
          .edit(ticket.openerDiscordUserId, {
            SendMessages: previousSendMessages,
            AddReactions: previousAddReactions,
          })
          .catch(() => undefined);
        await channel.setName(previousChannelName).catch(() => undefined);
        await prisma.ticket
          .updateMany({
            where: { id: ticket.id, status: 'closing' },
            data: { status: previousStatus },
          })
          .catch(() => undefined);
        console.error(
          'Ticket close failed:',
          error instanceof Error ? error.message : 'Unknown error',
        );
        return ticketFailure(
          interaction,
          'Ticket could not be closed. Try again or ask an administrator to reconcile this ticket.',
        );
      }

      await channel
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x777777)
              .setTitle(`Ticket #${ticket.ticketNumber.toString()} closed`)
              .setDescription(`Reason: ${reason}`)
              .setFooter({ text: `Closed by ${interaction.user.tag}` }),
          ],
          allowedMentions: { parse: [] },
        })
        .catch((error: unknown) => {
          console.error(
            'Ticket close notification failed:',
            error instanceof Error ? error.message : 'Unknown error',
          );
        });
      await interaction.editReply({
        content: `Ticket #${ticket.ticketNumber.toString()} has been closed.`,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (subcommand === 'reopen') {
      const isOpener = interaction.user.id === ticket.openerDiscordUserId;
      if (!isOpener && !isTicketStaff) {
        return ticketFailure(
          interaction,
          'Only the ticket opener or ticket staff can reopen this ticket.',
        );
      }
      if (!['closed', 'reopening'].includes(ticket.status)) {
        return ticketFailure(interaction, 'Only closed tickets can be reopened.');
      }

      const staleTransitionBefore = new Date(Date.now() - 2 * 60 * 1000);
      if (ticket.status === 'reopening') {
        if (ticket.updatedAt > staleTransitionBefore) {
          return ticketFailure(
            interaction,
            'A ticket reopen operation is already in progress. Try again in a moment.',
          );
        }
        const recovery = await prisma.ticket.updateMany({
          where: {
            id: ticket.id,
            status: 'reopening',
            updatedAt: { lt: staleTransitionBefore },
          },
          data: { status: 'reopening', updatedAt: new Date() },
        });
        if (recovery.count !== 1) {
          return ticketFailure(
            interaction,
            'Another ticket action is already in progress. Try again.',
          );
        }
      } else {
        const transition = await prisma.ticket.updateMany({
          where: { id: ticket.id, status: 'closed' },
          data: { status: 'reopening' },
        });
        if (transition.count !== 1) {
          return ticketFailure(
            interaction,
            'Another ticket action is already in progress. Try again.',
          );
        }
      }

      const previousOverwrite = channel.permissionOverwrites.cache.get(ticket.openerDiscordUserId);
      const previousSendMessages = previousOverwrite?.allow.has(PermissionFlagsBits.SendMessages)
        ? true
        : previousOverwrite?.deny.has(PermissionFlagsBits.SendMessages)
          ? false
          : null;
      const previousAddReactions = previousOverwrite?.allow.has(PermissionFlagsBits.AddReactions)
        ? true
        : previousOverwrite?.deny.has(PermissionFlagsBits.AddReactions)
          ? false
          : null;
      const previousAttachFiles = previousOverwrite?.allow.has(PermissionFlagsBits.AttachFiles)
        ? true
        : previousOverwrite?.deny.has(PermissionFlagsBits.AttachFiles)
          ? false
          : null;
      const previousEmbedLinks = previousOverwrite?.allow.has(PermissionFlagsBits.EmbedLinks)
        ? true
        : previousOverwrite?.deny.has(PermissionFlagsBits.EmbedLinks)
          ? false
          : null;
      const previousChannelName = channel.name;

      try {
        await channel.permissionOverwrites.edit(ticket.openerDiscordUserId, {
          ViewChannel: true,
          ReadMessageHistory: true,
          SendMessages: true,
          AttachFiles: true,
          EmbedLinks: true,
          AddReactions: true,
        });
        await channel.setName(`ticket-${ticket.ticketNumber.toString().padStart(4, '0')}`);
        await prisma.$transaction([
          prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              status: 'open',
              closeReason: null,
              closedAt: null,
              claimedByDiscordUserId: null,
            },
          }),
          prisma.auditLog.create({
            data: {
              guildId: guildRecord.id,
              actorDiscordUserId: interaction.user.id,
              action: 'ticket.reopened',
              resourceType: 'ticket',
              resourceId: ticket.id,
              oldValue: { status: 'closed', reason: ticket.closeReason },
              newValue: { status: 'open' },
              source: 'discord_bot',
            },
          }),
        ]);
      } catch (error) {
        await channel.permissionOverwrites
          .edit(ticket.openerDiscordUserId, {
            SendMessages: previousSendMessages,
            AddReactions: previousAddReactions,
            AttachFiles: previousAttachFiles,
            EmbedLinks: previousEmbedLinks,
          })
          .catch(() => undefined);
        await channel.setName(previousChannelName).catch(() => undefined);
        await prisma.ticket
          .updateMany({
            where: { id: ticket.id, status: 'reopening' },
            data: { status: 'closed' },
          })
          .catch(() => undefined);
        console.error(
          'Ticket reopen failed:',
          error instanceof Error ? error.message : 'Unknown error',
        );
        return ticketFailure(
          interaction,
          'Ticket could not be reopened. Try again or ask an administrator to reconcile this ticket.',
        );
      }

      await channel
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x9182ff)
              .setTitle(`Ticket #${ticket.ticketNumber.toString()} reopened`)
              .setDescription('The ticket is open again. Please continue the conversation here.'),
          ],
          allowedMentions: { parse: [] },
        })
        .catch((error: unknown) => {
          console.error(
            'Ticket reopen notification failed:',
            error instanceof Error ? error.message : 'Unknown error',
          );
        });
      await interaction.editReply({
        content: `Ticket #${ticket.ticketNumber.toString()} has been reopened.`,
        allowedMentions: { parse: [] },
      });
    }
  },
};
