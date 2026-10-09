import Redis = require("ioredis");

export type RedisConnection = InstanceType<typeof Redis>;

export function createRawRedisConnection(
  url: string,
  options: ConstructorParameters<typeof Redis>[1],
): RedisConnection {
  return new Redis(url, options);
}
