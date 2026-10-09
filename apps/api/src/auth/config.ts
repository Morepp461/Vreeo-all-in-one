import { env } from '../settings.js';

export class AuthNotConfiguredError extends Error {
  constructor() {
    super('Discord OAuth is not configured.');
    this.name = 'AuthNotConfiguredError';
  }
}

export function getAuthConfig() {
  const clientId = env.DISCORD_CLIENT_ID;
  const clientSecret = env.DISCORD_CLIENT_SECRET;
  const sessionSecret = env.SESSION_SECRET;
  const oauthTokenEncryptionKey = env.OAUTH_TOKEN_ENCRYPTION_KEY;

  if (!clientId || !clientSecret || !sessionSecret || !oauthTokenEncryptionKey) {
    throw new AuthNotConfiguredError();
  }

  return {
    clientId,
    clientSecret,
    sessionSecret,
    oauthTokenEncryptionKey,
    redirectUri: env.DISCORD_REDIRECT_URI,
    webOrigin: env.WEB_ORIGIN,
    sessionTtlSeconds: env.SESSION_TTL_SECONDS,
  };
}
