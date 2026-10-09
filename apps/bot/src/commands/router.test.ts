import { SlashCommandBuilder, type Interaction } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { BotInteractionRouter } from "./router.js";
import { CommandRegistry, type BotCommand } from "./registry.js";

function command(execute = vi.fn(async () => undefined)): BotCommand {
  return {
    data: new SlashCommandBuilder().setName("sample").setDescription("Test command"),
    cooldownMs: 500,
    execute,
  };
}
function context(consumeCooldown = vi.fn(async () => true)) {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    consumeCooldown,
  };
}
function commandInteraction(overrides: Record<string, unknown> = {}) {
  return {
    id: "interaction-1",
    commandName: "sample",
    guildId: "guild-1",
    user: { id: "user-1" },
    replied: false,
    deferred: false,
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    isMessageComponent: () => false,
    isRepliable: () => true,
    reply: vi.fn(async () => undefined),
    editReply: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as Interaction;
}

describe("Bot command registry and interaction router", () => {
  it("rejects duplicate command names and invalid cooldowns", () => {
    expect(() => new CommandRegistry([command(), command()])).toThrow(/Duplicate Discord command/);
    expect(() => new CommandRegistry([{ ...command(), cooldownMs: -1 }])).toThrow(/cooldown/);
  });

  it("executes registered commands only after the distributed cooldown is acquired", async () => {
    const execute = vi.fn(async () => undefined);
    const registry = new CommandRegistry([command(execute)]);
    const runtime = context();
    const router = new BotInteractionRouter(registry, runtime);
    const interaction = commandInteraction();
    await router.dispatch(interaction);
    expect(runtime.consumeCooldown).toHaveBeenCalledWith(["command", "sample", "guild-1", "user-1"], 500);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("does not execute a command when cooldown is active", async () => {
    const execute = vi.fn(async () => undefined);
    const router = new BotInteractionRouter(new CommandRegistry([command(execute)]), context(vi.fn(async () => false)));
    const interaction = commandInteraction();
    await router.dispatch(interaction);
    expect(execute).not.toHaveBeenCalled();
    expect((interaction as unknown as { reply: ReturnType<typeof vi.fn> }).reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Please wait before using this command again." }),
    );
  });

  it("routes components and modals by the longest registered custom ID prefix", async () => {
    const runtime = context();
    const router = new BotInteractionRouter(new CommandRegistry([]), runtime);
    const short = vi.fn(async () => undefined);
    const specific = vi.fn(async () => undefined);
    const modal = vi.fn(async () => undefined);
    router.registerComponent("ticket", short);
    router.registerComponent("ticket:close", specific);
    router.registerModal("ticket:create", modal);

    const component = commandInteraction({
      customId: "ticket:close:123",
      isChatInputCommand: () => false,
      isMessageComponent: () => true,
    });
    await router.dispatch(component);
    expect(specific).toHaveBeenCalledOnce();
    expect(short).not.toHaveBeenCalled();

    const modalInteraction = commandInteraction({
      customId: "ticket:create:123",
      isChatInputCommand: () => false,
      isModalSubmit: () => true,
    });
    await router.dispatch(modalInteraction);
    expect(modal).toHaveBeenCalledOnce();
  });

  it("fails closed for unknown commands and duplicate custom ID prefixes", async () => {
    const router = new BotInteractionRouter(new CommandRegistry([]), context());
    const interaction = commandInteraction({ commandName: "unknown" });
    await router.dispatch(interaction);
    expect((interaction as unknown as { reply: ReturnType<typeof vi.fn> }).reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: "This command is not available." }),
    );
    router.registerComponent("same", vi.fn(async () => undefined));
    expect(() => router.registerComponent("same", vi.fn(async () => undefined))).toThrow(/Duplicate component/);
  });
});
