import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { prisma } from '@vreeo/database/client';
import type { VreeoCommand } from '../types.js';
import { syncGuild } from '../../services/guild-sync.js';
import { replyFailure } from './shared.js';

function getDiscordRuleId(config: unknown): string | null {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const value = (config as Record<string, unknown>).discordRuleId;
  return typeof value === 'string' && /^\d{17,20}$/.test(value) ? value : null;
}

export const autoModCommand: VreeoCommand = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Manage Discord native keyword AutoMod rules.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Create a keyword filter rule.')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Rule name (letters, numbers, hyphens).')
            .setMinLength(3)
            .setMaxLength(93)
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('keywords')
            .setDescription('Comma-separated keywords or phrases (max 100).')
            .setMaxLength(2000)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List VREEO-managed AutoMod rules.'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a VREEO-managed AutoMod rule.')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name of the rule to remove.')
            .setMinLength(3)
            .setMaxLength(93)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable a VREEO-managed AutoMod rule.')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name of the rule.')
            .setMinLength(3)
            .setMaxLength(93)
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Whether the rule should be enabled.').setRequired(true),
        ),
    ),
  async execute(interaction) {
    if (!interaction.guild) {
      return replyFailure(interaction, 'This command only works in a server.');
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return replyFailure(interaction, 'You need the Manage Server permission.');
    }
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return replyFailure(
        interaction,
        'VREEO needs the Manage Server permission to manage Discord AutoMod rules.',
      );
    }

    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildRecord = await syncGuild(interaction.guild);

      if (subcommand === 'list') {
        const rules = await prisma.autoModRule.findMany({
          where: { guildId: guildRecord.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { name: true, ruleType: true, enabled: true, config: true, createdAt: true },
        });
        const embed = new EmbedBuilder()
          .setColor(0x9182ff)
          .setTitle('VREEO · AutoMod rules')
          .setDescription(
            rules.length
              ? rules
                  .map((rule) => {
                    const config =
                      rule.config && typeof rule.config === 'object' && !Array.isArray(rule.config)
                        ? (rule.config as Record<string, unknown>)
                        : {};
                    const keywords = Array.isArray(config.keywords)
                      ? config.keywords
                          .filter((word): word is string => typeof word === 'string')
                          .slice(0, 8)
                          .join(', ')
                      : 'Keyword list unavailable';
                    return `**${rule.name}** · ${rule.enabled ? 'Enabled' : 'Disabled'}\n${keywords}`;
                  })
                  .join('\n\n')
              : 'No VREEO-managed AutoMod rules have been configured.',
          )
          .setFooter({ text: 'Showing up to 20 rules managed by VREEO' });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const rawName = interaction.options.getString('name');
      const name = rawName?.trim().toLowerCase().replace(/\s+/g, '-');

      if (subcommand === 'add') {
        const nameOption = interaction.options
          .getString('name', true)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-');
        if (!/^[a-z0-9_-]{3,93}$/.test(nameOption)) {
          await interaction.editReply(
            'Use 3–93 lowercase letters, numbers, hyphens, or underscores for the rule name.',
          );
          return;
        }

        const existing = await prisma.autoModRule.findUnique({
          where: { guildId_name: { guildId: guildRecord.id, name: nameOption } },
          select: { id: true },
        });
        if (existing) {
          await interaction.editReply('A VREEO AutoMod rule with that name already exists.');
          return;
        }

        const rawKeywords = interaction.options.getString('keywords', true);
        const keywords = rawKeywords.split(',').map((word) => word.trim());
        if (
          keywords.length > 100 ||
          keywords.some((word) => word.length === 0 || word.length > 60) ||
          new Set(keywords.map((word) => word.toLocaleLowerCase())).size !== keywords.length
        ) {
          await interaction.editReply(
            'Provide 1–100 unique comma-separated keywords or phrases, each 1–60 characters long.',
          );
          return;
        }

        const rule = await interaction.guild.autoModerationRules.create({
          name: `vreeo-${nameOption}`,
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Keyword,
          triggerMetadata: { keywordFilter: keywords },
          actions: [
            {
              type: AutoModerationActionType.BlockMessage,
              metadata: {
                customMessage: 'Your message was blocked by this server’s AutoMod rules.',
              },
            },
          ],
          enabled: true,
          reason: `VREEO AutoMod configured by ${interaction.user.id}`,
        });

        try {
          await prisma.$transaction([
            prisma.autoModRule.create({
              data: {
                guildId: guildRecord.id,
                name: nameOption,
                ruleType: 'keyword_filter',
                enabled: true,
                config: { discordRuleId: rule.id, keywords },
              },
            }),
            prisma.auditLog.create({
              data: {
                guildId: guildRecord.id,
                actorDiscordUserId: interaction.user.id,
                action: 'automod.rule.created',
                resourceType: 'automod_rule',
                resourceId: rule.id,
                newValue: { name: nameOption, keywords },
                source: 'discord_bot',
              },
            }),
          ]);
        } catch (error) {
          await rule
            .delete('VREEO database persistence failed; rolling back created rule.')
            .catch((rollbackError: unknown) => {
              console.error(
                'AutoMod rollback failed; manual reconciliation required:',
                rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
              );
            });
          throw error;
        }

        await interaction.editReply(
          `AutoMod rule **${nameOption}** created with ${keywords.length} keyword(s). Discord will block matching messages.`,
        );
        return;
      }

      if (!name) {
        await interaction.editReply('A valid rule name is required.');
        return;
      }

      const storedRule = await prisma.autoModRule.findUnique({
        where: { guildId_name: { guildId: guildRecord.id, name } },
        select: { id: true, config: true, enabled: true },
      });
      if (!storedRule) {
        await interaction.editReply('No VREEO-managed AutoMod rule with that name was found.');
        return;
      }

      const discordRuleId = getDiscordRuleId(storedRule.config);
      if (!discordRuleId) {
        await interaction.editReply(
          'This stored rule is missing its Discord rule ID. It needs administrator reconciliation.',
        );
        return;
      }

      if (subcommand === 'remove') {
        const discordRule = await interaction.guild.autoModerationRules
          .fetch(discordRuleId)
          .catch((error: unknown) => {
            if (
              error &&
              typeof error === 'object' &&
              'status' in error &&
              error.status === 404
            ) {
              return null;
            }
            throw error;
          });
        if (discordRule) {
          await discordRule.delete(`VREEO AutoMod removed by ${interaction.user.id}`);
        }

        await prisma.$transaction([
          prisma.autoModRule.delete({ where: { id: storedRule.id } }),
          prisma.auditLog.create({
            data: {
              guildId: guildRecord.id,
              actorDiscordUserId: interaction.user.id,
              action: 'automod.rule.removed',
              resourceType: 'automod_rule',
              resourceId: discordRuleId,
              oldValue: { name, enabled: storedRule.enabled },
              source: 'discord_bot',
            },
          }),
        ]);
        await interaction.editReply(`AutoMod rule **${name}** removed.`);
        return;
      }

      if (subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled', true);
        const discordRule = await interaction.guild.autoModerationRules.fetch(discordRuleId);
        const previousEnabled = discordRule.enabled;
        await discordRule.setEnabled(enabled, `VREEO AutoMod toggled by ${interaction.user.id}`);

        try {
          await prisma.$transaction([
            prisma.autoModRule.update({ where: { id: storedRule.id }, data: { enabled } }),
            prisma.auditLog.create({
              data: {
                guildId: guildRecord.id,
                actorDiscordUserId: interaction.user.id,
                action: 'automod.rule.toggled',
                resourceType: 'automod_rule',
                resourceId: discordRuleId,
                oldValue: { name, enabled: previousEnabled },
                newValue: { name, enabled },
                source: 'discord_bot',
              },
            }),
          ]);
        } catch (error) {
          await discordRule
            .setEnabled(previousEnabled, 'VREEO database update failed; rolling back AutoMod state.')
            .catch(() => undefined);
          throw error;
        }

        await interaction.editReply(
          `AutoMod rule **${name}** is now ${enabled ? 'enabled' : 'disabled'}.`,
        );
      }
    } catch (error) {
      console.error(
        'AutoMod command failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      await replyFailure(
        interaction,
        'AutoMod could not complete that operation. Check Discord permissions and try again.',
      );
    }
  },
};
