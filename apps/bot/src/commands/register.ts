import type { Client } from "discord.js";
import type { Logger } from "pino";
import type { CommandRegistry } from "./registry.js";

export async function registerApplicationCommands(
  client: Client<true>,
  registry: CommandRegistry,
  logger: Pick<Logger, "info">,
  developmentGuildId?: string,
): Promise<void> {
  const commands = registry.toJSON();
  if (developmentGuildId) {
    await client.application.commands.set(commands, developmentGuildId);
    logger.info({ commandCount: commands.length, guildId: developmentGuildId }, "Development slash commands registered");
    return;
  }
  await client.application.commands.set(commands);
  logger.info({ commandCount: commands.length, scope: "global" }, "Global slash commands registered");
}
