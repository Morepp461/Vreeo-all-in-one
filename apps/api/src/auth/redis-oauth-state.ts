import { createHash } from "node:crypto";
import { buildRedisKey, type RedisConnection } from "@vreeo/redis";
import type { OAuthStateStore } from "./types.js";
const consumeStateScript = `
local value = redis.call("GET", KEYS[1])
if value then redis.call("DEL", KEYS[1]); return 1 end
return 0
`;
export class RedisOAuthStateStore implements OAuthStateStore {
  constructor(private readonly redis: RedisConnection) {}
  async issue(state: string, ttlSeconds: number): Promise<boolean> {
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) throw new Error("OAuth state TTL must be positive");
    const key = this.key(state);
    return (await this.redis.set(key, "1", "EX", ttlSeconds, "NX")) === "OK";
  }
  async consume(state: string): Promise<boolean> {
    return (await this.redis.eval(consumeStateScript, 1, this.key(state))) === 1;
  }
  private key(state: string): string {
    return buildRedisKey("oauth-state", createHash("sha256").update(state).digest("hex"));
  }
}
