import { afterAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';

const app = buildServer();

describe('API health and readiness', () => {
  afterAll(async () => {
    await app.close();
  });

  it('returns a healthy liveness response', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', service: 'vreeo-api' });
  });

  it('fails closed while dependency readiness checks are not implemented', async () => {
    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toHaveProperty('status', 'not_ready');
  });
});
