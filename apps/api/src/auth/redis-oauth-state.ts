import { createHash } from "node:crypto";
import { buildRedisKey, type RedisConnection } from "@vreeo/redis";
import type { OAuthStateStore } from "./types.js";
export class RedisOAuthStateStore implements OAuthStateStore {
  constructor(private readonly redis: RedisConnection) {}
  async issue(state: string, ttlSeconds: number, codeVerifier?: string): Promise<boolean> {
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) throw new Error("OAuth state TTL must be positive");
    const key = this.key(state);
    return (await this.redis.set(key, codeVerifier ?? "1", "EX", ttlSeconds, "NX")) === "OK";
  }
  async consume(state: string): Promise<string | null> {
    const value = await this.redis.getdel(this.key(state));
    return typeof value === "string" && value.length > 0 ? value : null;
  }
  private key(state: string): string {
    return buildRedisKey("oauth-state", createHash("sha256").update(state).digest("hex"));
  }
}
