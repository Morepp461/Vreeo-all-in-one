import type { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import type { Logger } from "pino";

export interface BotCommandContext {
  logger: Pick<Logger, "info" | "warn" | "error">;
  consumeCooldown: (keyParts: string[], ttlMs: number) => Promise<boolean>;
}
export interface BotCommand {
  data: SlashCommandBuilder;
  cooldownMs?: number;
  execute(interaction: ChatInputCommandInteraction, context: BotCommandContext): Promise<void>;
}
export class CommandRegistry {
  private readonly commands = new Map<string, BotCommand>();
  constructor(commands: readonly BotCommand[]) {
    for (const command of commands) {
      const name = command.data.name;
      if (!/^[a-z0-9_-]{1,32}$/.test(name)) throw new Error("Invalid Discord command name");
      if (this.commands.has(name)) throw new Error("Duplicate Discord command name: " + name);
      const cooldownMs = command.cooldownMs ?? 3_000;
      if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 0 || cooldownMs > 86_400_000) {
        throw new Error("Command cooldown must be an integer between 0 and 86400000 milliseconds");
      }
      this.commands.set(name, command);
    }
  }
  get(name: string): BotCommand | undefined { return this.commands.get(name); }
  all(): readonly BotCommand[] { return [...this.commands.values()]; }
  toJSON() { return this.all().map((command) => command.data.toJSON()); }
}
