import { describe, expect, it } from "vitest";
import { GuildSyncService, type DiscordGuildSnapshot, type GuildSyncRepository } from "./guild-sync.js";

const guild: DiscordGuildSnapshot = {
  discordGuildId: "123456789012345678",
  name: "VREEO Test",
  iconUrl: "https://cdn.discordapp.com/icons/123456789012345678/abcdef.png?size=128",
  ownerDiscordUserId: "234567890123456789",
};

class MemoryGuildSyncRepository implements GuildSyncRepository {
  readonly upserts: Array<{ snapshot: DiscordGuildSnapshot; observedAt: Date; botJoinedAt?: Date }> = [];
  readonly inactive: Array<{ id: string; at: Date }> = [];
  async upsertGuild(snapshot: DiscordGuildSnapshot, observedAt: Date, botJoinedAt?: Date): Promise<void> {
    this.upserts.push({ snapshot, observedAt, ...(botJoinedAt ? { botJoinedAt } : {}) });
  }
  async markGuildInactive(discordGuildId: string, observedAt: Date): Promise<void> {
    this.inactive.push({ id: discordGuildId, at: observedAt });
  }
}

describe("guild synchronization service", () => {
  it("validates and syncs guild metadata without inventing a join date", async () => {
    const repository = new MemoryGuildSyncRepository();
    const service = new GuildSyncService(repository);
    const observedAt = new Date("2026-10-09T00:00:00.000Z");
    await service.syncGuild(guild, { observedAt });
    expect(repository.upserts).toEqual([{ snapshot: guild, observedAt }]);
  });

  it("rejects malformed IDs, empty names, and untrusted icon URLs", async () => {
    const service = new GuildSyncService(new MemoryGuildSyncRepository());
    await expect(service.syncGuild({ ...guild, discordGuildId: "guild-1" })).rejects.toThrow(/numeric snowflakes/);
    await expect(service.syncGuild({ ...guild, name: " " })).rejects.toThrow(/guild name/);
    await expect(service.syncGuild({ ...guild, iconUrl: "https://attacker.example/icon.png" })).rejects.toThrow(/Discord CDN/);
  });

  it("marks only valid guild IDs inactive and bounds startup synchronization batches", async () => {
    const repository = new MemoryGuildSyncRepository();
    const service = new GuildSyncService(repository);
    const at = new Date("2026-10-09T00:00:00.000Z");
    await service.markGuildInactive(guild.discordGuildId, at);
    await expect(service.markGuildInactive("not-a-snowflake", at)).rejects.toThrow(/numeric snowflake/);
    const failures = await service.syncMany(Array.from({ length: 23 }, (_, i) => ({
      ...guild, discordGuildId: String(123456789012345678n + BigInt(i)),
    })), at);
    expect(failures).toEqual([]);
    expect(repository.upserts).toHaveLength(23);
    expect(repository.inactive).toEqual([{ id: guild.discordGuildId, at }]);
  });
});
