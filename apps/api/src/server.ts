import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { prisma } from '@vreeo/database/client';
import { authRoutes } from './auth/routes.js';
import { sendApiError } from './http/errors.js';
import { env } from './settings.js';

export function buildServer() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    trustProxy: false,
    requestIdHeader: false,
    genReqId: () => randomUUID(),
  });

  app.register(helmet);
  app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  });
  app.register(cookie);
  app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
  });
  app.register(authRoutes, { prefix: '/api/v1' });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500;
    const code =
      statusCode === 400
        ? 'VALIDATION_ERROR'
        : statusCode === 401
          ? 'AUTH_REQUIRED'
          : statusCode === 403
            ? 'PERMISSION_DENIED'
            : statusCode === 404
              ? 'RESOURCE_NOT_FOUND'
              : statusCode === 429
                ? 'RATE_LIMITED'
                : 'INTERNAL_ERROR';

    request.log.error(
      { errorName: error.name, statusCode, requestId: request.id },
      'API request failed',
    );

    return sendApiError(
      reply,
      request.id,
      statusCode,
      code,
      statusCode < 500 ? error.message : 'An unexpected error occurred.',
    );
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'vreeo-api',
    timestamp: new Date().toISOString(),
  }));

  app.get('/ready', async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', dependencies: { database: 'ok' } };
    } catch (error) {
      request.log.error(
        { errorName: error instanceof Error ? error.name : 'unknown' },
        'Readiness check failed',
      );
      return reply.code(503).send({
        status: 'not_ready',
        dependencies: { database: 'unavailable' },
      });
    }
  });

  return app;
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;

if (entrypoint === import.meta.url) {
  const app = buildServer();
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'Shutting down API server');
    try {
      await app.close();
      await prisma.$disconnect();
    } catch (error) {
      app.log.error(
        { errorName: error instanceof Error ? error.name : 'unknown' },
        'API shutdown failed',
      );
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  app.listen({ host: env.API_HOST, port: env.API_PORT }).catch((error: unknown) => {
    app.log.error(
      { errorName: error instanceof Error ? error.name : 'unknown' },
      'API failed to start',
    );
    process.exitCode = 1;
  });
}
