import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '@vreeo/database/client';
import { env } from '../settings.js';
import { sendApiError } from '../http/errors.js';
import { createOpaqueToken, safeEqual } from './crypto.js';
import { encryptOAuthToken } from './token-crypto.js';
import {
  DiscordAccessError,
  getDiscordAccessToken,
  getManageableDiscordGuilds,
} from './discord-access.js';
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
const guildRouteParams = z.object({
  discordGuildId: z.string().regex(/^\d{17,20}$/),
});

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const settingsPatchSchema = z
  .object({
    locale: z
      .string()
      .max(10)
      .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
      .optional(),
    timezone: z
      .string()
      .min(1)
      .max(64)
      .refine(isValidTimeZone, 'Use a valid IANA time zone.')
      .optional(),
    prefix: z.string().min(1).max(20).regex(/^\S+$/).nullable().optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'At least one setting must be provided.');

function cookieOptions(maxAge: number, path = '/') {
  return {
    path,
    maxAge,
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };
}

function requireAuth(request: FastifyRequest) {
  return resolveSession(request.cookies?.[sessionCookieName], env.SESSION_SECRET);
}

type AuthenticatedSession = NonNullable<Awaited<ReturnType<typeof resolveSession>>>;
type GuildAccessResult = { guildId: string } | { error: FastifyReply };

async function resolveGuildAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  session: AuthenticatedSession,
  config: ReturnType<typeof getAuthConfig>,
  discordGuildId: string,
): Promise<GuildAccessResult> {
  try {
    const accessToken = await getDiscordAccessToken(session.user.discordUserId, config);
    const manageableGuilds = await getManageableDiscordGuilds(accessToken);
    if (!manageableGuilds.some((guild) => guild.id === discordGuildId)) {
      return {
        error: sendApiError(
          reply,
          request.id,
          403,
          'PERMISSION_DENIED',
          'Your Discord account does not have Manage Server access to this server.',
        ),
      };
    }

    const guild = await prisma.guild.findUnique({
      where: { discordGuildId },
      select: { id: true, active: true },
    });
    if (!guild?.active) {
      return {
        error: sendApiError(
          reply,
          request.id,
          409,
          'BOT_NOT_IN_GUILD',
          'VREEO must be installed in this server before it can be configured.',
        ),
      };
    }

    return { guildId: guild.id };
  } catch (error) {
    request.log.warn(
      { errorName: error instanceof Error ? error.name : 'unknown' },
      'Guild access verification failed',
    );
    if (error instanceof DiscordAccessError) {
      return {
        error: sendApiError(reply, request.id, error.statusCode, error.code, error.message),
      };
    }
    return {
      error: sendApiError(
        reply,
        request.id,
        500,
        'INTERNAL_ERROR',
        'Guild access could not be verified.',
      ),
    };
  }
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
    reply.clearCookie(stateCookieName, cookieOptions(0, callbackPath));

    if (!parsedQuery.success) {
      return sendApiError(
        reply,
        request.id,
        400,
        'VALIDATION_ERROR',
        'Discord returned an invalid login response.',
      );
    }

    const query = parsedQuery.data;
    const cookieState = request.cookies?.[stateCookieName];

    if (!query.state || !cookieState || !safeEqual(query.state, cookieState)) {
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
      return sendApiError(
        reply,
        request.id,
        400,
        'VALIDATION_ERROR',
        'Discord did not return an authorization code.',
      );
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
      const {
        user: discordUser,
        scopes,
        accessToken,
        refreshToken,
        tokenExpiresAt,
      } = await exchangeDiscordCode(query.code, config);
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
        request.log.error(
          { discordUserId: discordUser.id },
          'OAuth account linkage invariant failed',
        );
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
          accessTokenCiphertext: encryptOAuthToken(accessToken, config.oauthTokenEncryptionKey),
          refreshTokenCiphertext: refreshToken
            ? encryptOAuthToken(refreshToken, config.oauthTokenEncryptionKey)
            : null,
          tokenExpiresAt,
        },
        update: {
          scopes,
          accessTokenCiphertext: encryptOAuthToken(accessToken, config.oauthTokenEncryptionKey),
          ...(refreshToken
            ? {
                refreshTokenCiphertext: encryptOAuthToken(
                  refreshToken,
                  config.oauthTokenEncryptionKey,
                ),
              }
            : {}),
          tokenExpiresAt,
        },
      });

      const rawSessionToken = createOpaqueToken();
      await createSession(user.id, rawSessionToken, config.sessionSecret, config.sessionTtlSeconds);
      reply.setCookie(sessionCookieName, rawSessionToken, cookieOptions(config.sessionTtlSeconds));
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

  app.get('/guilds', async (request, reply) => {
    const session = await requireAuth(request);
    if (!session) {
      return sendApiError(reply, request.id, 401, 'AUTH_REQUIRED', 'Please sign in to continue.');
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
      const accessToken = await getDiscordAccessToken(session.user.discordUserId, config);
      const manageableGuilds = await getManageableDiscordGuilds(accessToken);
      const botGuilds = await prisma.guild.findMany({
        where: {
          discordGuildId: { in: manageableGuilds.map((guild) => guild.id) },
          active: true,
        },
        select: { discordGuildId: true },
      });
      const installedGuildIds = new Set(botGuilds.map((guild) => guild.discordGuildId));

      reply.header('Cache-Control', 'no-store');
      return reply.send({
        data: manageableGuilds.map((guild) => ({
          id: guild.id,
          name: guild.name,
          iconUrl: guild.icon
            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
            : null,
          owner: guild.owner ?? false,
          botInstalled: installedGuildIds.has(guild.id),
        })),
      });
    } catch (error) {
      request.log.warn(
        { errorName: error instanceof Error ? error.name : 'unknown' },
        'Discord guild list request failed',
      );
      if (error instanceof DiscordAccessError) {
        return sendApiError(reply, request.id, error.statusCode, error.code, error.message);
      }
      return sendApiError(
        reply,
        request.id,
        500,
        'INTERNAL_ERROR',
        'Discord server list could not be loaded.',
      );
    }
  });

  app.get('/guilds/:discordGuildId/settings', async (request, reply) => {
    const session = await requireAuth(request);
    if (!session) {
      return sendApiError(reply, request.id, 401, 'AUTH_REQUIRED', 'Please sign in to continue.');
    }
    const params = guildRouteParams.safeParse(request.params);
    if (!params.success) {
      return sendApiError(
        reply,
        request.id,
        400,
        'VALIDATION_ERROR',
        'A valid Discord server ID is required.',
      );
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

    const access = await resolveGuildAccess(
      request,
      reply,
      session,
      config,
      params.data.discordGuildId,
    );
    if ('error' in access) return access.error;

    const settings = await prisma.guildSettings.findUnique({
      where: { guildId: access.guildId },
      select: { id: true, locale: true, timezone: true, prefix: true, updatedAt: true },
    });
    reply.header('Cache-Control', 'no-store');
    return reply.send({
      data: settings ?? {
        id: null,
        locale: 'en-US',
        timezone: 'UTC',
        prefix: null,
        updatedAt: null,
      },
    });
  });

  app.patch('/guilds/:discordGuildId/settings', async (request, reply) => {
    if (request.headers.origin !== env.WEB_ORIGIN) {
      return sendApiError(
        reply,
        request.id,
        403,
        'CSRF_INVALID',
        'Request origin could not be verified.',
      );
    }

    const session = await requireAuth(request);
    if (!session) {
      return sendApiError(reply, request.id, 401, 'AUTH_REQUIRED', 'Please sign in to continue.');
    }
    const params = guildRouteParams.safeParse(request.params);
    if (!params.success) {
      return sendApiError(
        reply,
        request.id,
        400,
        'VALIDATION_ERROR',
        'A valid Discord server ID is required.',
      );
    }
    const patch = settingsPatchSchema.safeParse(request.body);
    if (!patch.success) {
      return sendApiError(
        reply,
        request.id,
        400,
        'VALIDATION_ERROR',
        'The server settings are invalid.',
        { fields: patch.error.issues.map((issue) => issue.path.join('.')) },
      );
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

    const access = await resolveGuildAccess(
      request,
      reply,
      session,
      config,
      params.data.discordGuildId,
    );
    if ('error' in access) return access.error;

    try {
      const settings = await prisma.$transaction(async (tx) => {
        const previous = await tx.guildSettings.findUnique({
          where: { guildId: access.guildId },
          select: { locale: true, timezone: true, prefix: true },
        });
        const updated = await tx.guildSettings.upsert({
          where: { guildId: access.guildId },
          create: { guildId: access.guildId, ...patch.data },
          update: patch.data,
          select: { id: true, locale: true, timezone: true, prefix: true, updatedAt: true },
        });

        await tx.auditLog.create({
          data: {
            guildId: access.guildId,
            actorDiscordUserId: session.user.discordUserId,
            action: 'guild.settings.updated',
            resourceType: 'guild_settings',
            resourceId: updated.id,
            oldValue: {
              locale: previous?.locale ?? 'en-US',
              timezone: previous?.timezone ?? 'UTC',
              prefix: previous?.prefix ?? null,
            },
            newValue: patch.data,
            source: 'dashboard',
          },
        });
        return updated;
      });

      reply.header('Cache-Control', 'no-store');
      return reply.send({ data: settings });
    } catch (error) {
      request.log.error(
        { errorName: error instanceof Error ? error.name : 'unknown' },
        'Guild settings update failed',
      );
      return sendApiError(
        reply,
        request.id,
        500,
        'INTERNAL_ERROR',
        'Server settings could not be saved.',
      );
    }
  });

  app.get('/auth/me', async (request, reply) => {
    const session = await requireAuth(request);
    if (!session) {
      return sendApiError(reply, request.id, 401, 'AUTH_REQUIRED', 'Please sign in to continue.');
    }

    reply.header('Cache-Control', 'no-store');
    return reply.send({ data: session.user });
  });

  app.post('/auth/logout', async (request, reply) => {
    if (request.headers.origin !== env.WEB_ORIGIN) {
      return sendApiError(
        reply,
        request.id,
        403,
        'CSRF_INVALID',
        'Request origin could not be verified.',
      );
    }

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

    reply.header('Cache-Control', 'no-store');
    return reply.send({
      data: sessions.map((item) => ({ ...item, current: item.id === session.id })),
    });
  });

  app.delete('/auth/sessions/:sessionId', async (request, reply) => {
    if (request.headers.origin !== env.WEB_ORIGIN) {
      return sendApiError(
        reply,
        request.id,
        403,
        'CSRF_INVALID',
        'Request origin could not be verified.',
      );
    }

    const session = await requireAuth(request);
    if (!session) {
      return sendApiError(reply, request.id, 401, 'AUTH_REQUIRED', 'Please sign in to continue.');
    }

    const params = z.object({ sessionId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return sendApiError(
        reply,
        request.id,
        400,
        'VALIDATION_ERROR',
        'A valid session ID is required.',
      );
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
