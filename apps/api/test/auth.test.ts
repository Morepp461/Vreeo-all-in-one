import { afterAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';

const app = buildServer();

describe('API authentication boundary', () => {
  afterAll(async () => {
    await app.close();
  });

  it('does not start OAuth when credentials are missing', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/discord' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: { code: 'SERVICE_UNAVAILABLE' },
    });
    expect(response.headers.location).toBeUndefined();
  });

  it('requires an authenticated session for the current-user endpoint', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: { code: 'AUTH_REQUIRED' },
    });
  });

  it('requires an authenticated session before returning guild data', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/guilds' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: { code: 'AUTH_REQUIRED' },
    });
  });

  it('requires an authenticated session before reading guild settings', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/guilds/123456789012345678/settings',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'AUTH_REQUIRED' } });
  });

  it('rejects guild settings writes without a trusted origin', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/guilds/123456789012345678/settings',
      payload: { locale: 'id-ID' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'CSRF_INVALID' } });
  });

  it('rejects session revocation requests without a trusted origin', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/sessions/123e4567-e89b-12d3-a456-426614174000',
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'CSRF_INVALID' } });
  });

  it('rejects logout requests without a trusted browser origin', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: { code: 'CSRF_INVALID' },
    });
  });

  it('rejects OAuth callbacks without a matching state cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/discord/callback?code=sample-code&state=sample-state',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'OAUTH_STATE_INVALID' },
    });
  });
});
