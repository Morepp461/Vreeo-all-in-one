import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { createLogger } from "@vreeo/logger";
import Fastify, { type FastifyInstance } from "fastify";
import type { Logger } from "pino";

export interface ReadinessCheck {
  name: string;
  check: () => Promise<void>;
}
export interface BuildServerOptions {
  logger?: Logger;
  readinessChecks?: ReadinessCheck[];
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
    loggerInstance: options.logger ?? createLogger({ service: "api" }),
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId",
    trustProxy: false,
    bodyLimit: 1_048_576,
  });
  const readinessChecks = options.readinessChecks ?? [];

  await app.register(helmet);
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    errorResponseBuilder: (request, _context) => ({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
        requestId: request.id,
      },
    }),
  });

  app.setNotFoundHandler((request, reply) => reply.code(404).send({
    error: { code: "NOT_FOUND", message: "The requested resource was not found.", requestId: request.id },
  }));

  app.setErrorHandler((error, request, reply) => {
    const statusCode = typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode : 500;
    if (statusCode >= 500) request.log.error({ err: error }, "Request failed unexpectedly");
    const message = statusCode >= 500
      ? "An unexpected error occurred."
      : statusCode === 400 ? "The request is invalid." : error.message;
    return reply.code(statusCode).send({
      error: { code: errorCode(statusCode), message, requestId: request.id },
    });
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "api",
    version: process.env.npm_package_version ?? "0.1.0",
  }));

  app.get("/health/ready", async (_request, reply) => {
    const checks = await Promise.all(readinessChecks.map(async ({ name, check }) => {
      try {
        await check();
        return { name, status: "ok" as const };
      } catch {
        return { name, status: "unavailable" as const };
      }
    }));
    if (checks.length === 0 || checks.some((check) => check.status !== "ok")) {
      return reply.code(503).send({
        status: "not_ready",
        service: "api",
        checks: checks.length === 0 ? [{ name: "dependencies", status: "not_configured" }] : checks,
      });
    }
    return { status: "ok", service: "api", checks };
  });
  return app;
}
