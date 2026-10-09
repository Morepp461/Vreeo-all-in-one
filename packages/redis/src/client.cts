import Redis = require("ioredis");

export type RedisConnection = InstanceType<typeof Redis.default>;

export function createRawRedisConnection(
  url: string,
  options: ConstructorParameters<typeof Redis.default>[1],
): RedisConnection {
  return new Redis.default(url, options);
}
