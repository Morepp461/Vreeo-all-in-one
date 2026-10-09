import { EventEmitter } from "node:events";
import type { DatabaseClient } from "@vreeo/database";
import { Events, type Client } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "../commands/registry.js";
import { BotEventRouter } from "./router.js";

describe("Bot gateway event router", () => {
  it("routes guild create and delete events to the guild registry", async () => {
    const client = new EventEmitter() as unknown as Client;
    const database = {
      guild: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as DatabaseClient;
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() };
    const onFatal = vi.fn();
    new BotEventRouter({ client, database, logger, commands: new CommandRegistry([]), onFatal }).attach();

    const guild = { id: "123456789012345678", name: "Community", ownerId: "234567890123456789", iconURL: () => null };
    client.emit(Events.GuildCreate, guild);
    await vi.waitFor(() => expect(database.guild.upsert).toHaveBeenCalledOnce());
    expect(database.guild.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { discordGuildId: guild.id },
      create: expect.objectContaining({ active: true, ownerDiscordUserId: guild.ownerId, iconUrl: "" }),
    }));

    client.emit(Events.GuildDelete, guild);
    await vi.waitFor(() => expect(database.guild.updateMany).toHaveBeenCalledOnce());
    expect(database.guild.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { discordGuildId: guild.id },
      data: expect.objectContaining({ active: false, botJoinedAt: null }),
    }));
    expect(onFatal).not.toHaveBeenCalled();
  });
});
