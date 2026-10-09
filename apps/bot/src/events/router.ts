import { Events, type Client } from "discord.js";
import type { DatabaseClient } from "@vreeo/database";
import type { Logger } from "pino";
import type { CommandRegistry } from "../commands/registry.js";
import { registerApplicationCommands } from "../commands/register.js";
import { markBotGuildLeft, syncBotGuild } from "../guild-registry.js";

export interface BotEventRouterOptions {
  client: Client;
  database: DatabaseClient;
  logger: Pick<Logger, "info" | "warn" | "error" | "fatal">;
  commands: CommandRegistry;
  developmentGuildId?: string;
  onFatal: (error: unknown) => void;
}

export class BotEventRouter {
  constructor(private readonly options: BotEventRouterOptions) {}

  attach(): void {
    const { client, database, logger } = this.options;
    client.once(Events.ClientReady, (readyClient) => {
      logger.info({ botUserId: readyClient.user.id, guildCount: readyClient.guilds.cache.size }, "Discord gateway connected");
      void this.onReady(readyClient).catch((error) => {
        logger.fatal({ err: error }, "Bot startup synchronization failed");
        this.options.onFatal(error);
      });
    });
    client.on(Events.GuildCreate, (guild) => {
      void syncBotGuild(database, guild).catch((error) => logger.error({ err: error, guildId: guild.id }, "Failed to register Discord guild"));
    });
    client.on(Events.GuildDelete, (guild) => {
      void markBotGuildLeft(database, guild.id).catch((error) => logger.error({ err: error, guildId: guild.id }, "Failed to deactivate Discord guild"));
    });
    client.on(Events.Error, (error) => logger.error({ err: error }, "Discord client error"));
  }

  private async onReady(readyClient: Client<true>): Promise<void> {
    const guilds = [...readyClient.guilds.cache.values()];
    const results = await Promise.allSettled(guilds.map((guild) => syncBotGuild(this.options.database, guild)));
    const failures = results.flatMap((result, index) => result.status === "rejected"
      ? [{ guildId: guilds[index]?.id ?? "unknown", reason: result.reason }]
      : []);
    for (const failure of failures) this.options.logger.error({ err: failure.reason, guildId: failure.guildId }, "Guild registry synchronization failed");
    if (failures.length > 0) throw new Error("Failed to synchronize " + failures.length + " Discord guild record(s)");
    await registerApplicationCommands(readyClient, this.options.commands, this.options.logger, this.options.developmentGuildId);
    this.options.logger.info({ guildCount: guilds.length }, "Discord guild registry synchronized");
  }
}
