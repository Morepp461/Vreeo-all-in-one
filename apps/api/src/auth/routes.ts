import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vreeo/database/client';
import { env } from '../settings.js';
import { sendApiError } from '../http/errors.js';
import { createOpaqueToken, hashOpaqueToken, safeEqual } from './crypto.js';
import { AuthNotConfiguredError, getAuthConfig } from './config.js';
import { exchangeDiscordCode, DiscordOAuthError } from './discord-oauth.js';
import { createSession, resolveSession, revokeSession } from './session.js';

const sessionCookieName = 'vreeo_session';
const stateCookieName = 'vreeo_oauth_state';
const callbackPath = '/api/v1/auth/discord/callback';
const oauthQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
});

function cookieOptions(maxAge: number, path = '/') {
  return {
    path,
    maxAge,
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };
}

function requireAuth(request: Parameters<Parameters<FastifyInstance['get']>[1]>[0]) {
  return resolveSession(request.cookies?.[sessionCookieName], env.SESSION_SECRET);
}

export async function authRoutes(app: FastifyInstance) {
  app.get('/auth/discord', async (request, reply) => {
    let config;
    try {
      config = getAuthConfig();
    } catch (error) {
      if (error instanceof AuthNotConfiguredError) {
        return sendApiError(
          reply,
          request.id,
          503,
          'SERVICE_UNAVAILABLE',
          'Discord login is not configured yet.',
        );
      }
      throw error;
    }

    const state = randomBytes(32).toString('base64url');
    const authorizeUrl = new URL('https://discord.com/oauth2/authorize');
    authorizeUrl.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
    }).toString();

    reply.header('Cache-Control', 'no-store');
    reply.setCookie(stateCookieName, state, cookieOptions(600, callbackPath));
    return reply.redirect(authorizeUrl.toString());
  });

  app.get('/auth/discord/callback', async (request, reply) => {
    const parsedQuery = oauthQuerySchema.safeParse(request.query);
    const query = parsedQuery.success ? parsedQuery.data : {};
    const cookieState = request.cookies?.[stateCookieName];

    reply.clearCookie(stateCookieName, cookieOptions(0, callbackPath));

    if (!parsedQuery.success || !query.state || !cookieState || !safeEqual(query.state, cookieState)) {
      return sendApiError(
        reply,
        request.id,
        400,
        'OAUTH_STATE_INVALID',
        'The login session expired or could not be verified. Please try again.',
      );
    }

    if (query.error) {
      return sendApiError(reply, request.id, 400, 'OAUTH_DENIED', 'Discord login was cancelled.');
    }

    if (!query.code) {
      return sendApiError(reply, request.id, 400, 'VALIDATION_ERROR', 'Discord did not return an authorization code.');
    }

    let config;
    try {
      config = getAuthConfig();
    } catch (error) {
      if (error instanceof AuthNotConfiguredError) {
        return sendApiError(
          reply,
          request.id,
          503,
          'SERVICE_UNAVAILABLE',
          'Discord login is not configured yet.',
        );
      }
      throw error;
    }

    try {
      const { user: discordUser, scopes } = await exchangeDiscordCode(query.code, config);
      const now = new Date();
      const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=256`
        : null;

      const user = await prisma.user.upsert({
        where: { discordUserId: discordUser.id },
        create: {
          discordUserId: discordUser.id,
          username: discordUser.username,
          displayName: discordUser.global_name ?? discordUser.username,
          avatarUrl,
          locale: discordUser.locale ?? null,
          lastLoginAt: now,
        },
        update: {
          username: discordUser.username,
          displayName: discordUser.global_name ?? discordUser.username,
          avatarUrl,
          locale: discordUser.locale ?? null,
          lastLoginAt: now,
        },
        select: { id: true, discordUserId: true },
      });

      const existingAccount = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: 'discord',
            providerAccountId: discordUser.id,
          },
        },
        select: { userId: true },
      });

      if (existingAccount && existingAccount.userId !== user.id) {
        request.log.error({ discordUserId: discordUser.id }, 'OAuth account linkage invariant failed');
        return sendApiError(
          reply,
          request.id,
          409,
          'RESOURCE_CONFLICT',
          'This Discord account could not be linked to the VREEO user.',
        );
      }

      await prisma.oAuthAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: 'discord',
            providerAccountId: discordUser.id,
          },
        },
        create: {
          userId: user.id,
          provider: 'discord',
          providerAccountId: discordUser.id,
          scopes,
        },
        update: { scopes },
      });

      const rawSessionToken = createOpaqueToken();
      await createSession(user.id, rawSessionToken, config.sessionSecret, config.sessionTtlSeconds);
      reply.setCookie(
        sessionCookieName,
        rawSessionToken,
        cookieOptions(config.sessionTtlSeconds),
      );
      reply.header('Cache-Control', 'no-store');
      return reply.redirect(config.webOrigin);
    } catch (error) {
      request.log.warn(
        { errorType: error instanceof Error ? error.name : 'unknown' },
        'Discord OAuth callback failed',
      );
      if (error instanceof DiscordOAuthError) {
        return sendApiError(
          reply,
          request.id,
          502,
          'DISCORD_API_ERROR',
          'Discord login could not be completed. Please try again.',
        );
      }
      return sendApiError(
        reply,
        request.id,
        500,
        'INTERNAL_ERROR',
        'Login could not be completed. Please try again.',
      );
    }
  });

  app.get('/auth/me', async (request, reply) => {
    const session = await requireAuth(request);
    if (!session) {
      return sendApiError(reply, request.id, 401, 'AUTH_REQUIRED', 'Please sign in to continue.');
    }

    return reply.send({ data: session.user });
  });

  app.post('/auth/logout', async (request, reply) => {
    await revokeSession(request.cookies?.[sessionCookieName], env.SESSION_SECRET);
    reply.clearCookie(sessionCookieName, cookieOptions(0));
    return reply.code(204).send();
  });

  app.get('/auth/sessions', async (request, reply) => {
    const session = await requireAuth(request);
    if (!session) {
      return sendApiError(reply, request.id, 401, 'AUTH_REQUIRED', 'Please sign in to continue.');
    }

    const sessions = await prisma.session.findMany({
      where: {
        userId: session.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        lastSeenAt: true,
      },
    });

    return reply.send({
      data: sessions.map((item) => ({ ...item, current: item.id === session.id })),
    });
  });

  app.delete('/auth/sessions/:sessionId', async (request, reply) => {
    const session = await requireAuth(request);
    if (!session) {
      return sendApiError(reply, request.id, 401, 'AUTH_REQUIRED', 'Please sign in to continue.');
    }

    const params = z.object({ sessionId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return sendApiError(reply, request.id, 400, 'VALIDATION_ERROR', 'A valid session ID is required.');
    }

    const result = await prisma.session.updateMany({
      where: {
        id: params.data.sessionId,
        userId: session.userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      return sendApiError(reply, request.id, 404, 'RESOURCE_NOT_FOUND', 'Session not found.');
    }

    if (params.data.sessionId === session.id) {
      reply.clearCookie(sessionCookieName, cookieOptions(0));
    }

    return reply.code(204).send();
  });
}
