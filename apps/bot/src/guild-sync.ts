import type { PrismaClient } from "@vreeo/database";

export interface DiscordGuildSnapshot {
  discordGuildId: string;
  name: string;
  iconUrl: string;
  ownerDiscordUserId: string;
}

export interface GuildSyncRepository {
  upsertGuild(snapshot: DiscordGuildSnapshot, observedAt: Date, botJoinedAt?: Date): Promise<void>;
  markGuildInactive(discordGuildId: string, observedAt: Date): Promise<void>;
}

export interface GuildSyncFailure {
  discordGuildId: string;
  errorName: string;
}

function isDiscordId(value: string): boolean {
  return /^\d{1,32}$/.test(value);
}

function isAllowedIconUrl(value: string): boolean {
  if (value === "") return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "cdn.discordapp.com" &&
      url.username === "" && url.password === "" && url.hash === "";
  } catch {
    return false;
  }
}

/** Synchronizes gateway observations; it does not infer member state or Discord permissions. */
export class GuildSyncService {
  constructor(private readonly repository: GuildSyncRepository) {}

  async syncGuild(snapshot: DiscordGuildSnapshot, options: { observedAt?: Date; botJoinedAt?: Date } = {}): Promise<void> {
    if (!isDiscordId(snapshot.discordGuildId) || !isDiscordId(snapshot.ownerDiscordUserId)) {
      throw new TypeError("Discord guild and owner IDs must be numeric snowflakes");
    }
    if (snapshot.name.trim().length === 0 || snapshot.name.length > 200) {
      throw new TypeError("Discord guild name must contain 1 to 200 characters");
    }
    if (!isAllowedIconUrl(snapshot.iconUrl)) throw new TypeError("Guild icon URL is not an allowed Discord CDN URL");
    const observedAt = options.observedAt ?? new Date();
    if (!Number.isFinite(observedAt.getTime())) throw new TypeError("Guild observation time must be valid");
    if (options.botJoinedAt && !Number.isFinite(options.botJoinedAt.getTime())) {
      throw new TypeError("Bot join time must be valid");
    }
    await this.repository.upsertGuild(snapshot, observedAt, options.botJoinedAt);
  }

  async markGuildInactive(discordGuildId: string, observedAt = new Date()): Promise<void> {
    if (!isDiscordId(discordGuildId)) throw new TypeError("Discord guild ID must be a numeric snowflake");
    if (!Number.isFinite(observedAt.getTime())) throw new TypeError("Guild observation time must be valid");
    await this.repository.markGuildInactive(discordGuildId, observedAt);
  }

  async syncMany(snapshots: readonly DiscordGuildSnapshot[], observedAt = new Date()): Promise<GuildSyncFailure[]> {
    const failures: GuildSyncFailure[] = [];
    for (let offset = 0; offset < snapshots.length; offset += 10) {
      const batch = snapshots.slice(offset, offset + 10);
      const results = await Promise.allSettled(batch.map((snapshot) => this.syncGuild(snapshot, { observedAt })));
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          failures.push({
            discordGuildId: batch[index]?.discordGuildId ?? "unknown",
            errorName: result.reason instanceof Error ? result.reason.name : "UnknownError",
          });
        }
      });
    }
    return failures;
  }
}

export class PrismaGuildSyncRepository implements GuildSyncRepository {
  constructor(private readonly database: PrismaClient) {}

  async upsertGuild(snapshot: DiscordGuildSnapshot, observedAt: Date, botJoinedAt?: Date): Promise<void> {
    const existing = await this.database.guild.findUnique({
      where: { discordGuildId: snapshot.discordGuildId },
      select: { active: true },
    });
    const joinedAt = botJoinedAt && existing?.active === false ? botJoinedAt : botJoinedAt && !existing ? botJoinedAt : undefined;
    await this.database.guild.upsert({
      where: { discordGuildId: snapshot.discordGuildId },
      create: {
        discordGuildId: snapshot.discordGuildId,
        name: snapshot.name,
        iconUrl: snapshot.iconUrl,
        ownerDiscordUserId: snapshot.ownerDiscordUserId,
        active: true,
        botJoinedAt: joinedAt ?? null,
        lastSeenAt: observedAt,
      },
      update: {
        name: snapshot.name,
        iconUrl: snapshot.iconUrl,
        ownerDiscordUserId: snapshot.ownerDiscordUserId,
        active: true,
        lastSeenAt: observedAt,
        ...(joinedAt ? { botJoinedAt: joinedAt } : {}),
      },
    });
  }

  async markGuildInactive(discordGuildId: string, observedAt: Date): Promise<void> {
    await this.database.guild.updateMany({
      where: { discordGuildId, active: true },
      data: { active: false, lastSeenAt: observedAt },
    });
  }
}
