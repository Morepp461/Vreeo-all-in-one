import type { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export interface VreeoCommand {
  data: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
