import "dotenv/config";
import { createDatabaseClient } from "@vreeo/database";
import { loadApiConfig } from "@vreeo/config";
import { createLogger, createLoggerOptions } from "@vreeo/logger";
import { checkRedisReady, closeRedisConnection, createRedisConnection } from "@vreeo/redis";
import { buildServer } from "./server.js";

const config = loadApiConfig();
const loggerOptions = createLoggerOptions({ service: "api", level: config.logLevel });
const logger = createLogger({ service: "api", level: config.logLevel });
const database = createDatabaseClient();
const redis = createRedisConnection({ url: config.redisUrl, logger });
const app = await buildServer({
  loggerOptions,
  redis,
  readinessChecks: [
    {
      name: "postgres",
      check: async () => {
        await database.$queryRaw`SELECT 1`;
      },
    },
    {
      name: "redis",
      check: () => checkRedisReady(redis),
    },
  ],
});

let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down API");
  try {
    await app.close();
    await closeRedisConnection(redis);
    await database.$disconnect();
  } catch (error) {
    logger.error({ err: error, signal }, "API shutdown failed");
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
  try {
    await app.close();
    await closeRedisConnection(redis);
    await database.$disconnect();
  } catch (shutdownError) {
    logger.error({ err: shutdownError }, "API cleanup after startup failure failed");
  }
  process.exitCode = 1;
}
