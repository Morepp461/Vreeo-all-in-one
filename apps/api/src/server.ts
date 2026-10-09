import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './settings.js';

export function buildServer() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    trustProxy: false,
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  });

  app.register(helmet);
  app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'vreeo-api',
    timestamp: new Date().toISOString(),
  }));

  app.get('/ready', async (_request, reply) => {
    // Dependency checks are added with the infrastructure implementation phase.
    return reply.code(503).send({
      status: 'not_ready',
      reason: 'dependency_checks_not_implemented',
    });
  });

  return app;
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isEntrypoint) {
  const app = buildServer();
  app.listen({ host: env.API_HOST, port: env.API_PORT }).catch((error: unknown) => {
    app.log.error({ err: error }, 'API failed to start');
    process.exitCode = 1;
  });
}
