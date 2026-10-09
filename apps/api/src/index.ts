import "dotenv/config";
import { loadApiConfig } from "@vreeo/config";
import { createLogger, createLoggerOptions } from "@vreeo/logger";
import { buildServer } from "./server.js";

const config = loadApiConfig();
const loggerOptions = createLoggerOptions({ service: "api", level: config.logLevel });
const logger = createLogger({ service: "api", level: config.logLevel });
const app = await buildServer({ loggerOptions });

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  logger.info({ signal }, "Shutting down API");
  try {
    await app.close();
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
  await app.close();
  process.exitCode = 1;
}
