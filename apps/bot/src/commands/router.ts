import {
  Events,
  MessageFlags,
  type ChatInputCommandInteraction,
  type Client,
  type Interaction,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import type { BotCommandContext, CommandRegistry } from "./registry.js";

type ComponentHandler = (interaction: MessageComponentInteraction, context: BotCommandContext) => Promise<void>;
type ModalHandler = (interaction: ModalSubmitInteraction, context: BotCommandContext) => Promise<void>;

function validatePrefix(prefix: string): void {
  if (!/^[A-Za-z0-9:_-]{1,100}$/.test(prefix)) throw new Error("Interaction custom ID prefix is invalid");
}

export class BotInteractionRouter {
  private readonly componentHandlers = new Map<string, ComponentHandler>();
  private readonly modalHandlers = new Map<string, ModalHandler>();

  constructor(private readonly registry: CommandRegistry, private readonly context: BotCommandContext) {}

  registerComponent(prefix: string, handler: ComponentHandler): void {
    validatePrefix(prefix);
    if (this.componentHandlers.has(prefix)) throw new Error("Duplicate component handler prefix: " + prefix);
    this.componentHandlers.set(prefix, handler);
  }

  registerModal(prefix: string, handler: ModalHandler): void {
    validatePrefix(prefix);
    if (this.modalHandlers.has(prefix)) throw new Error("Duplicate modal handler prefix: " + prefix);
    this.modalHandlers.set(prefix, handler);
  }

  attach(client: Client): void {
    client.on(Events.InteractionCreate, (interaction) => {
      void this.dispatch(interaction).catch((error) => {
        this.context.logger.error({ err: error, interactionId: interaction.id }, "Interaction router failed unexpectedly");
        if (interaction.isRepliable()) {
          void interaction.reply({ content: "This interaction could not be completed. Please try again.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
        }
      });
    });
  }

  async dispatch(interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand()) return this.dispatchCommand(interaction);
    if (interaction.isModalSubmit()) return this.dispatchModal(interaction);
    if (interaction.isMessageComponent()) return this.dispatchComponent(interaction);
  }

  private async dispatchCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.registry.get(interaction.commandName);
    if (!command) {
      await this.replySafely(interaction, "This command is not available.");
      return;
    }
    try {
      const cooldownMs = command.cooldownMs ?? 3_000;
      if (cooldownMs > 0) {
        const allowed = await this.context.consumeCooldown([
          "command", command.data.name, interaction.guildId ?? "dm", interaction.user.id,
        ], cooldownMs);
        if (!allowed) {
          await this.replySafely(interaction, "Please wait before using this command again.");
          return;
        }
      }
      await command.execute(interaction, this.context);
    } catch (error) {
      this.context.logger.error({
        err: error, commandName: interaction.commandName, guildId: interaction.guildId, interactionId: interaction.id,
      }, "Discord command execution failed");
      await this.replySafely(interaction, "The command could not be completed. Please try again.");
    }
  }

  private async dispatchComponent(interaction: MessageComponentInteraction): Promise<void> {
    const match = this.findHandler(interaction.customId, this.componentHandlers);
    if (!match) {
      await this.replySafely(interaction, "This interaction is no longer available.");
      return;
    }
    try { await match(interaction, this.context); }
    catch (error) {
      this.context.logger.error({ err: error, customIdPrefix: this.prefixFor(interaction.customId, this.componentHandlers), interactionId: interaction.id }, "Component interaction failed");
      await this.replySafely(interaction, "This interaction could not be completed. Please try again.");
    }
  }

  private async dispatchModal(interaction: ModalSubmitInteraction): Promise<void> {
    const match = this.findHandler(interaction.customId, this.modalHandlers);
    if (!match) {
      await this.replySafely(interaction, "This form is no longer available.");
      return;
    }
    try { await match(interaction, this.context); }
    catch (error) {
      this.context.logger.error({ err: error, customIdPrefix: this.prefixFor(interaction.customId, this.modalHandlers), interactionId: interaction.id }, "Modal interaction failed");
      await this.replySafely(interaction, "This form could not be submitted. Please try again.");
    }
  }

  private findHandler<T>(customId: string, handlers: Map<string, T>): T | undefined {
    const prefix = this.prefixFor(customId, handlers);
    return prefix ? handlers.get(prefix) : undefined;
  }

  private prefixFor<T>(customId: string, handlers: Map<string, T>): string | undefined {
    return [...handlers.keys()].filter((prefix) => customId === prefix || customId.startsWith(prefix + ":"))
      .sort((left, right) => right.length - left.length)[0];
  }

  private async replySafely(interaction: ChatInputCommandInteraction | MessageComponentInteraction | ModalSubmitInteraction, content: string): Promise<void> {
    if (!interaction.isRepliable()) return;
    try {
      if (interaction.replied || interaction.deferred) await interaction.editReply({ content });
      else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    } catch (error) {
      this.context.logger.warn({ err: error, interactionId: interaction.id }, "Could not send interaction fallback response");
    }
  }
}
