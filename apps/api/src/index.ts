import Fastify from 'fastify';

const app = Fastify({ logger: true });
const host = process.env.API_HOST ?? '0.0.0.0';
const port = Number(process.env.API_PORT ?? 4000);

app.get('/health', async () => ({ status: 'ok', service: 'vreeo-api', timestamp: new Date().toISOString() }));
app.get('/', async () => ({ name: 'VREEO API', version: '0.1.0' }));

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
