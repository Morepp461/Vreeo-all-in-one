import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildRedisKey,
  checkRedisReady,
  closeRedisConnection,
  consumeCooldown,
  createRedisConnection,
  getJson,
  setJson,
  withDistributedLock,
} from "./index.js";

const redis = createRedisConnection({
  url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
});

beforeAll(async () => {
  await checkRedisReady(redis);
});

afterAll(async () => {
  await closeRedisConnection(redis);
});

describe("Redis primitives", () => {
  it("namespaces keys and encodes delimiter characters", () => {
    expect(buildRedisKey("cache", "guild:123", "settings"))
      .toBe("vreeo:cache:guild%3A123:settings");
  });

  it("round-trips JSON and deletes malformed cached values", async () => {
    const key = buildRedisKey("test", "cache", randomUUID());
    const value = { guildId: "123", enabled: true };
    await setJson(redis, key, value, 30);
    expect(await getJson<typeof value>(redis, key)).toEqual(value);

    await redis.set(key, "not-json", "EX", 30);
    expect(await getJson(redis, key)).toBeNull();
    expect(await redis.exists(key)).toBe(0);
  });

  it("allows only one cooldown claim until expiry", async () => {
    const key = ["test", randomUUID()];
    expect(await consumeCooldown(redis, key, 5_000)).toBe(true);
    expect(await consumeCooldown(redis, key, 5_000)).toBe(false);
  });

  it("releases owned locks and refuses to take an occupied lock", async () => {
    const parts = ["test", randomUUID()];
    const result = await withDistributedLock(redis, parts, 5_000, async () => "done");
    expect(result).toEqual({ acquired: true, value: "done" });
    expect(await redis.get(buildRedisKey("lock", ...parts))).toBeNull();

    const occupiedParts = ["test", randomUUID()];
    const occupiedKey = buildRedisKey("lock", ...occupiedParts);
    await redis.set(occupiedKey, "other-owner", "PX", 5_000, "NX");
    expect(await withDistributedLock(redis, occupiedParts, 5_000, async () => "wrong"))
      .toEqual({ acquired: false });
    await redis.del(occupiedKey);
  });

  it("rejects invalid TTLs and empty lock scopes", async () => {
    await expect(setJson(redis, buildRedisKey("test", randomUUID()), { ok: true }, 0))
      .rejects.toThrow(/TTL/);
    await expect(consumeCooldown(redis, [], 100)).rejects.toThrow(/key part/);
    await expect(withDistributedLock(redis, [], 100, async () => undefined))
      .rejects.toThrow(/key part/);
  });
});
