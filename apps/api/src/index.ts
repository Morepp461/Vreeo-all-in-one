import "dotenv/config";
import { createDatabaseClient } from "@vreeo/database";
import { loadApiConfig } from "@vreeo/config";
import { createLogger, createLoggerOptions } from "@vreeo/logger";
import { createQueue } from "@vreeo/queue";
import { checkRedisReady, closeRedisConnection, createRedisConnection } from "@vreeo/redis";
import { DiscordOAuthHttpProvider } from "./auth/discord-oauth-provider.js";
import { PrismaAuthRepository } from "./auth/prisma-auth-repository.js";
import { RedisOAuthStateStore } from "./auth/redis-oauth-state.js";
import { buildServer } from "./server.js";

const config = loadApiConfig();
const loggerOptions = createLoggerOptions({ service: "api", level: config.logLevel });
const logger = createLogger({ service: "api", level: config.logLevel });
const database = createDatabaseClient({ url: config.databaseUrl });
const redis = createRedisConnection({ url: config.redisUrl, logger });
const readinessQueue = createQueue("api-readiness", redis);
const authRepository = new PrismaAuthRepository(database);
const oauthStateStore = new RedisOAuthStateStore(redis);
const oauthProvider = config.discordOAuth ? new DiscordOAuthHttpProvider(config.discordOAuth) : null;
const app = await buildServer({
  loggerOptions, redis,
  auth: { config, repository: authRepository, stateStore: oauthStateStore, provider: oauthProvider },
  readinessChecks: [
    { name: "postgres", check: async () => { await database.$queryRaw`SELECT 1`; } },
    { name: "redis", check: () => checkRedisReady(redis) },
    { name: "queue", check: async () => {
      await readinessQueue.waitUntilReady();
      await readinessQueue.getJobCounts("waiting", "active", "delayed", "failed", "completed");
    } },
  ],
});
async function closeRuntime(): Promise<void> {
  let failed = false;
  try { await app.close(); } catch (error) { failed = true; logger.error({ err: error }, "API server shutdown failed"); }
  try { await readinessQueue.close(); } catch (error) { failed = true; logger.error({ err: error }, "API readiness queue shutdown failed"); }
  const results = await Promise.allSettled([closeRedisConnection(redis), database.$disconnect()]);
  for (const result of results) if (result.status === "rejected") {
    failed = true; logger.error({ err: result.reason }, "API dependency shutdown failed");
  }
  if (failed) process.exitCode = 1;
}
let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down API");
  await closeRuntime();
};
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
try {
  await app.listen({ host: config.apiHost, port: config.apiPort });
  logger.info({ host: config.apiHost, port: config.apiPort }, "API listening");
} catch (error) {
  logger.fatal({ err: error }, "API failed to start");
  await closeRuntime();
  process.exitCode = 1;
}
