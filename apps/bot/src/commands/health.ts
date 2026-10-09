import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./registry.js";

export const healthCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("vreeo-health")
    .setDescription("Check whether the VREEO bot is responding."),
  cooldownMs: 3_000,
  async execute(interaction) {
    await interaction.reply({ content: "VREEO is online.", flags: MessageFlags.Ephemeral });
  },
};
