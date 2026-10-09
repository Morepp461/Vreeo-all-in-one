import { ChannelType, PermissionFlagsBits, type ButtonInteraction } from 'discord.js';
import { prisma } from '@vreeo/database/client';
import { syncGuild } from './guild-sync.js';
import { createTicketChannel, loadTicketSettings } from './ticket-service.js';

export async function handleTicketPanelButton(interaction: ButtonInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: 'Ticket panels can only be used inside a server.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const panelId = interaction.customId.slice('vreeo:ticket:create:'.length);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(panelId)) {
    await interaction.editReply('This ticket panel button is invalid.');
    return;
  }

  try {
    const guildRecord = await syncGuild(guild);
    const panel = await prisma.ticketPanel.findFirst({
      where: { id: panelId, guildId: guildRecord.id, enabled: true },
      select: { id: true, name: true },
    });
    if (!panel) {
      await interaction.editReply(
        'This ticket panel is no longer active. Ask a server administrator to publish a new one.',
      );
      return;
    }

    const botMember = guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.editReply('VREEO needs the Manage Channels permission to open tickets.');
      return;
    }

    const settings = await loadTicketSettings(guildRecord.id);
    if (!settings.enabled || !settings.ticketCategoryId) {
      await interaction.editReply(
        'The ticket system is not configured. Ask a server administrator to run /ticket setup.',
      );
      return;
    }
    const category = await guild.channels.fetch(settings.ticketCategoryId).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory || category.guildId !== guild.id) {
      await interaction.editReply(
        'The configured ticket category no longer exists. Ask an administrator to run /ticket setup again.',
      );
      return;
    }
    if (settings.staffRoleId && !guild.roles.cache.has(settings.staffRoleId)) {
      await interaction.editReply(
        'The configured ticket staff role no longer exists. Ask an administrator to run /ticket setup again.',
      );
      return;
    }

    const result = await createTicketChannel({
      guild,
      guildRecordId: guildRecord.id,
      userId: interaction.user.id,
      interactionId: interaction.id,
      subject: panel.name,
      categoryId: category.id,
      staffRoleId: settings.staffRoleId,
      botUserId: botMember.id,
    });
    if (result.status === 'failed') {
      await interaction.editReply(
        'This ticket request already failed. Please use the panel again.',
      );
      return;
    }
    if (result.channelId) {
      await interaction.editReply(
        result.existing
          ? `This ticket request was already processed: <#${result.channelId}>.`
          : `Your ticket has been opened: <#${result.channelId}>`,
      );
      return;
    }
    await interaction.editReply(
      'Your ticket request is already being processed. Please wait a moment.',
    );
  } catch (error) {
    console.error(
      'Ticket panel interaction failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    await interaction.editReply(
      'VREEO could not open a ticket from this panel. Please try again or contact a server administrator.',
    );
  }
}
