import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { createLoggerOptions } from "@vreeo/logger";
import type { RedisConnection } from "@vreeo/redis";
import Fastify, { type FastifyInstance } from "fastify";
import type { LoggerOptions } from "pino";
import { registerAuthRoutes } from "./auth/routes.js";
import type { AuthRouteDependencies } from "./auth/types.js";
import { registerGuildRoutes } from "./guilds/routes.js";
import type { GuildRouteDependencies } from "./guilds/types.js";
import { registerGuildContextRoutes } from "./guilds/context.js";

export interface ReadinessCheck { name: string; check: () => Promise<void>; }
export interface BuildServerOptions {
  loggerOptions?: LoggerOptions;
  readinessChecks?: ReadinessCheck[];
  redis?: RedisConnection;
  auth?: AuthRouteDependencies;
  guilds?: GuildRouteDependencies;
}
function errorCode(statusCode: number): string {
  switch (statusCode) {
    case 400: return "VALIDATION_ERROR";
    case 401: return "UNAUTHORIZED";
    case 403: return "FORBIDDEN";
    case 404: return "NOT_FOUND";
    case 409: return "CONFLICT";
    case 429: return "RATE_LIMITED";
    default: return statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR";
  }
}
export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.loggerOptions ?? createLoggerOptions({ service: "api" }),
    requestIdHeader: false,
    genReqId: (request) => {
      const supplied = request.headers["x-request-id"];
      return typeof supplied === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(supplied) ? supplied : randomUUID();
    },
    requestIdLogLabel: "requestId",
    trustProxy: false,
    bodyLimit: 1_048_576,
  });
  const readinessChecks = options.readinessChecks ?? [];
  await app.register(helmet);
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true, max: 120, timeWindow: "1 minute",
    ...(options.redis ? { redis: options.redis } : {}),
    errorResponseBuilder: (request) => ({
      error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later.", requestId: request.id },
    }),
  });
  if (options.auth) await registerAuthRoutes(app, options.auth);
  if (options.guilds) {
    await registerGuildRoutes(app, options.guilds);
    await registerGuildContextRoutes(app, options.guilds);
  }
  app.setNotFoundHandler((request, reply) => reply.code(404).send({
    error: { code: "NOT_FOUND", message: "The requested resource was not found.", requestId: request.id },
  }));
  app.setErrorHandler((error, request, reply) => {
    const candidate = typeof error === "object" && error !== null ? error as { statusCode?: unknown; message?: unknown } : {};
    const statusCode = typeof candidate.statusCode === "number" && candidate.statusCode >= 400 && candidate.statusCode < 600 ? candidate.statusCode : 500;
    if (statusCode >= 500) request.log.error({ err: error }, "Request failed unexpectedly");
    const message = statusCode >= 500 ? "An unexpected error occurred." : statusCode === 400 ? "The request is invalid." : typeof candidate.message === "string" ? candidate.message : "The request failed.";
    return reply.code(statusCode).send({ error: { code: errorCode(statusCode), message, requestId: request.id } });
  });
  app.get("/health", { config: { rateLimit: false } }, async () => ({
    status: "ok", service: "api", version: process.env.npm_package_version ?? "0.1.0",
  }));
  app.get("/health/ready", { config: { rateLimit: false } }, async (request, reply) => {
    const checks = await Promise.all(readinessChecks.map(async ({ name, check }) => {
      try { await check(); return { name, status: "ok" as const }; }
      catch {
        request.log.warn({ dependency: name }, "Readiness dependency check failed");
        return { name, status: "unavailable" as const };
      }
    }));
    if (checks.length === 0 || checks.some((check) => check.status !== "ok")) {
      return reply.code(503).send({
        status: "not_ready", service: "api",
        checks: checks.length === 0 ? [{ name: "dependencies", status: "not_configured" }] : checks,
      });
    }
    return { status: "ok", service: "api", checks };
  });
  return app;
}
