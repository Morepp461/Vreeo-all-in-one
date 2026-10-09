import { ChannelType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { prisma } from '@vreeo/database/client';
import type { VreeoCommand } from './types.js';
import { syncGuild } from '../services/guild-sync.js';
import { replyFailure } from './moderation/shared.js';

type TicketSettings = {
  ticketCategoryId: string | null;
  staffRoleId: string | null;
};

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readTicketSettings(config: unknown): TicketSettings {
  const object = readObject(config);
  const category = object.ticketCategoryId;
  const staffRole = object.ticketStaffRoleId;
  return {
    ticketCategoryId:
      typeof category === 'string' && /^\d{17,20}$/.test(category) ? category : null,
    staffRoleId: typeof staffRole === 'string' && /^\d{17,20}$/.test(staffRole) ? staffRole : null,
  };
}

async function loadTicketSettings(guildId: string): Promise<TicketSettings> {
  const feature = await prisma.guildFeature.findUnique({
    where: { guildId_featureKey: { guildId, featureKey: 'tickets' } },
    select: { config: true },
  });
  return readTicketSettings(feature?.config);
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
      return replyFailure(interaction, 'This command only works in a server.');
    }

    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const guildRecord = await syncGuild(guild);

    if (subcommand === 'setup') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return replyFailure(
          interaction,
          'You need the Manage Server permission to configure tickets.',
        );
      }
      if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return replyFailure(
          interaction,
          'VREEO needs the Manage Channels permission to configure tickets.',
        );
      }

      const category = interaction.options.getChannel('category', true);
      if (category.type !== ChannelType.GuildCategory) {
        return replyFailure(interaction, 'Choose a category from this server.');
      }
      const staffRole = interaction.options.getRole('staff_role');
      if (staffRole && staffRole.id === guild.id) {
        return replyFailure(
          interaction,
          'The @everyone role cannot be used as the ticket staff role.',
        );
      }

      await interaction.deferReply({ ephemeral: true });
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
        await replyFailure(
          interaction,
          'Ticket setup failed. Please check the bot permissions and try again.',
        );
      }
      return;
    }

    if (subcommand === 'open') {
      if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return replyFailure(
          interaction,
          'VREEO needs the Manage Channels permission to open tickets.',
        );
      }
      const subject = interaction.options.getString('subject', true).trim();
      if (subject.length < 3) {
        return replyFailure(interaction, 'The ticket subject must contain at least 3 characters.');
      }

      const settings = await loadTicketSettings(guildRecord.id);
      if (!settings.ticketCategoryId) {
        return replyFailure(
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
        return replyFailure(
          interaction,
          'The configured ticket category no longer exists. Ask an administrator to run /ticket setup again.',
        );
      }
      if (settings.staffRoleId && !guild.roles.cache.has(settings.staffRoleId)) {
        return replyFailure(
          interaction,
          'The configured ticket staff role no longer exists. Ask an administrator to run /ticket setup again.',
        );
      }

      await interaction.deferReply({ ephemeral: true });
      let ticket: { id: string; ticketNumber: bigint } | null = null;
      let channelId: string | null = null;
      try {
        ticket = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${guildRecord.id}))`;
          const latest = await tx.ticket.aggregate({
            where: { guildId: guildRecord.id },
            _max: { ticketNumber: true },
          });
          const ticketNumber = (latest._max.ticketNumber ?? 0n) + 1n;
          const created = await tx.ticket.create({
            data: {
              guildId: guildRecord.id,
              ticketNumber,
              openerDiscordUserId: interaction.user.id,
              subject,
              status: 'creating',
            },
            select: { id: true, ticketNumber: true },
          });
          await tx.auditLog.create({
            data: {
              guildId: guildRecord.id,
              actorDiscordUserId: interaction.user.id,
              action: 'ticket.creation.started',
              resourceType: 'ticket',
              resourceId: created.id,
              newValue: { ticketNumber: ticketNumber.toString(), subject },
              source: 'discord_bot',
            },
          });
          return created;
        });

        const overwrites = [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
          {
            id: interaction.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
            ],
          },
          ...(settings.staffRoleId
            ? [
                {
                  id: settings.staffRoleId,
                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                  ],
                },
              ]
            : []),
        ];

        const channel = await guild.channels.create({
          name: `ticket-${ticket.ticketNumber.toString().padStart(4, '0')}`,
          type: ChannelType.GuildText,
          parent: category.id,
          topic:
            `VREEO ticket #${ticket.ticketNumber.toString()} • Opener: ${interaction.user.id} • Subject: ${subject}`.slice(
              0,
              1024,
            ),
          permissionOverwrites: overwrites,
          reason: `VREEO ticket #${ticket.ticketNumber.toString()} opened by ${interaction.user.id}`,
        });
        channelId = channel.id;

        await prisma.$transaction([
          prisma.ticket.update({
            where: { id: ticket.id },
            data: { channelDiscordId: channel.id, status: 'open' },
          }),
          prisma.auditLog.create({
            data: {
              guildId: guildRecord.id,
              actorDiscordUserId: interaction.user.id,
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
              .setDescription(subject)
              .addFields({ name: 'Opened by', value: `<@${interaction.user.id}>`, inline: true })
              .setFooter({ text: 'VREEO Support • Use /ticket close when finished' }),
          ],
          allowedMentions: { parse: [] },
        });
        await interaction.editReply(`Your ticket has been opened: <#${channel.id}>`);
      } catch (error) {
        if (channelId) {
          await guild.channels
            .delete(channelId, 'VREEO ticket database persistence failed')
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
          await writeTicketAudit({
            guildId: guildRecord.id,
            actorId: interaction.user.id,
            action: 'ticket.creation.failed',
            ticketId: ticket.id,
            newValue: {
              error: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error',
            },
          }).catch(() => undefined);
        }
        console.error(
          'Ticket creation failed:',
          error instanceof Error ? error.message : 'Unknown error',
        );
        await replyFailure(
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
        return replyFailure(
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
      await interaction.reply({ embeds: [embed], ephemeral: true, allowedMentions: { parse: [] } });
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
      },
    });
    if (!ticket || !ticket.channelDiscordId) {
      return replyFailure(interaction, 'This command must be used inside a VREEO ticket channel.');
    }
    const channel = await guild.channels.fetch(ticket.channelDiscordId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return replyFailure(
        interaction,
        'The ticket channel is missing or is not a text channel. An administrator may need to reconcile this ticket.',
      );
    }

    if (subcommand === 'claim') {
      if (!isTicketStaff)
        return replyFailure(
          interaction,
          'Only configured ticket staff or members with Manage Channels can claim tickets.',
        );
      if (!['open', 'claimed'].includes(ticket.status))
        return replyFailure(interaction, 'Only active tickets can be claimed.');
      if (ticket.claimedByDiscordUserId && ticket.claimedByDiscordUserId !== interaction.user.id) {
        return replyFailure(
          interaction,
          `This ticket is already claimed by <@${ticket.claimedByDiscordUserId}>.`,
        );
      }
      const result = await prisma.ticket.updateMany({
        where: {
          id: ticket.id,
          status: { in: ['open', 'claimed'] },
          OR: [{ claimedByDiscordUserId: null }, { claimedByDiscordUserId: interaction.user.id }],
        },
        data: { status: 'claimed', claimedByDiscordUserId: interaction.user.id },
      });
      if (result.count !== 1)
        return replyFailure(
          interaction,
          'Another staff member claimed this ticket first. Refresh and try again.',
        );
      await writeTicketAudit({
        guildId: guildRecord.id,
        actorId: interaction.user.id,
        action: 'ticket.claimed',
        ticketId: ticket.id,
        oldValue: { claimedByDiscordUserId: ticket.claimedByDiscordUserId },
        newValue: { claimedByDiscordUserId: interaction.user.id, status: 'claimed' },
      });
      await interaction.reply({
        content: `Ticket #${ticket.ticketNumber.toString()} claimed by <@${interaction.user.id}>.`,
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
        return replyFailure(
          interaction,
          'Only the ticket opener or ticket staff can close this ticket.',
        );
      }
      if (!['open', 'claimed', 'closing'].includes(ticket.status)) {
        return replyFailure(interaction, 'This ticket is already closed.');
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
      if (ticket.status !== 'closing') {
        const transition = await prisma.ticket.updateMany({
          where: { id: ticket.id, status: { in: ['open', 'claimed'] } },
          data: { status: 'closing' },
        });
        if (transition.count !== 1) {
          return replyFailure(
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
        throw error;
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
      await interaction.reply({
        content: `Ticket #${ticket.ticketNumber.toString()} has been closed.`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'reopen') {
      const isOpener = interaction.user.id === ticket.openerDiscordUserId;
      if (!isOpener && !isTicketStaff) {
        return replyFailure(
          interaction,
          'Only the ticket opener or ticket staff can reopen this ticket.',
        );
      }
      if (!['closed', 'reopening'].includes(ticket.status)) {
        return replyFailure(interaction, 'Only closed tickets can be reopened.');
      }

      if (ticket.status !== 'reopening') {
        const transition = await prisma.ticket.updateMany({
          where: { id: ticket.id, status: 'closed' },
          data: { status: 'reopening' },
        });
        if (transition.count !== 1) {
          return replyFailure(
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
        throw error;
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
      await interaction.reply({
        content: `Ticket #${ticket.ticketNumber.toString()} has been reopened.`,
        ephemeral: true,
      });
    }
  },
};
