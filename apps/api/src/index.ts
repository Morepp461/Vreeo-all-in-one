import "dotenv/config";
import { loadApiConfig } from "@vreeo/config";
import { createLogger, createLoggerOptions } from "@vreeo/logger";
import { checkRedisReady, closeRedisConnection, createRedisConnection } from "@vreeo/redis";
import { buildServer } from "./server.js";

const config = loadApiConfig();
const loggerOptions = createLoggerOptions({ service: "api", level: config.logLevel });
const logger = createLogger({ service: "api", level: config.logLevel });
const redis = createRedisConnection({ url: config.redisUrl, logger });
const app = await buildServer({
  loggerOptions,
  redis,
  readinessChecks: [
    { name: "redis", check: () => checkRedisReady(redis) },
    { name: "database", check: async () => { throw new Error("Database adapter is not wired yet"); } },
    { name: "queue", check: async () => { throw new Error("Queue worker is not wired yet"); } },
  ],
});

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  logger.info({ signal }, "Shutting down API");
  try {
    await app.close();
  } catch (error) {
    logger.error({ err: error, signal }, "API shutdown failed");
    process.exitCode = 1;
  }
  try {
    await closeRedisConnection(redis);
  } catch (error) {
    logger.error({ err: error, signal }, "Redis shutdown failed");
    process.exitCode = 1;
  }
};
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.apiHost, port: config.apiPort });
  logger.info({ host: config.apiHost, port: config.apiPort }, "API listening");
} catch (error) {
  logger.fatal({ err: error }, "API failed to start");
  await app.close();
  await closeRedisConnection(redis);
  process.exitCode = 1;
}
