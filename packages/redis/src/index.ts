import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import Redis from "ioredis";

export type RedisConnection = InstanceType<typeof Redis.default>;

export interface CreateRedisConnectionOptions {
  url: string;
  logger?: Pick<Logger, "warn">;
}

export function createRedisConnection(options: CreateRedisConnectionOptions): RedisConnection {
  const connection = new Redis.default(options.url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (attempt) => Math.min(attempt * 100, 2_000),
  });
  if (options.logger) {
    connection.on("error", (error) => {
      options.logger?.warn({ err: error }, "Redis connection error");
    });
  }
  return connection;
}

export function buildRedisKey(namespace: string, ...parts: string[]): string {
  const segments = [namespace, ...parts];
  if (segments.some((segment) => segment.trim().length === 0)) {
    throw new Error("Redis key segments must be non-empty");
  }
  return `vreeo:${segments.map((segment) => encodeURIComponent(segment)).join(":")}`;
}

function assertKeyParts(keyParts: string[]): void {
  if (keyParts.length === 0 || keyParts.some((part) => part.trim().length === 0)) {
    throw new Error("At least one non-empty Redis key part is required");
  }
}

export async function checkRedisReady(connection: RedisConnection): Promise<void> {
  const response = await connection.ping();
  if (response !== "PONG") {
    throw new Error("Redis health check did not return PONG");
  }
}

export async function getJson<T>(connection: RedisConnection, key: string): Promise<T | null> {
  const raw = await connection.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    await connection.del(key);
    return null;
  }
}

export async function setJson<T>(
  connection: RedisConnection,
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("Cache TTL must be a positive integer number of seconds");
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("Cache value cannot be serialized to JSON");
  }
  await connection.set(key, serialized, "EX", ttlSeconds);
}

export async function consumeCooldown(
  connection: RedisConnection,
  keyParts: string[],
  ttlMs: number,
): Promise<boolean> {
  assertKeyParts(keyParts);
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new Error("Cooldown TTL must be a positive integer number of milliseconds");
  }
  const key = buildRedisKey("cooldown", ...keyParts);
  return (await connection.set(key, "1", "PX", ttlMs, "NX")) === "OK";
}

const releaseLockScript = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export type LockResult<T> = { acquired: true; value: T } | { acquired: false };

export async function withDistributedLock<T>(
  connection: RedisConnection,
  keyParts: string[],
  ttlMs: number,
  operation: () => Promise<T>,
): Promise<LockResult<T>> {
  assertKeyParts(keyParts);
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new Error("Lock TTL must be a positive integer number of milliseconds");
  }
  const key = buildRedisKey("lock", ...keyParts);
  const token = randomUUID();
  const acquired = await connection.set(key, token, "PX", ttlMs, "NX");
  if (acquired !== "OK") return { acquired: false };

  let operationFailed = false;
  try {
    return { acquired: true, value: await operation() };
  } catch (error) {
    operationFailed = true;
    throw error;
  } finally {
    try {
      await connection.eval(releaseLockScript, 1, key, token);
    } catch (releaseError) {
      if (!operationFailed) throw releaseError;
    }
  }
}

export async function closeRedisConnection(connection: RedisConnection): Promise<void> {
  if (connection.status === "ready") {
    await connection.quit();
  } else {
    connection.disconnect();
  }
}
