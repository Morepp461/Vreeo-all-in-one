import { z } from 'zod';
import { prisma } from '@vreeo/database/client';
import { refreshDiscordAccessToken } from './discord-oauth.js';
import { decryptOAuthToken, encryptOAuthToken } from './token-crypto.js';

type DiscordOAuthConfig = {
  clientId: string;
  clientSecret: string;
  oauthTokenEncryptionKey: string;
};

const discordGuildSchema = z.object({
  id: z.string().regex(/^\d{1,32}$/),
  name: z.string().min(1).max(200),
  icon: z.string().nullable().optional(),
  owner: z.boolean().optional(),
  permissions: z.string().regex(/^\d+$/),
});

export type DiscordGuildAccess = z.infer<typeof discordGuildSchema>;

export class DiscordAccessError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DiscordAccessError';
  }
}

export async function getDiscordAccessToken(
  discordUserId: string,
  config: DiscordOAuthConfig,
): Promise<string> {
  const account = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: 'discord',
        providerAccountId: discordUserId,
      },
    },
    select: {
      id: true,
      scopes: true,
      accessTokenCiphertext: true,
      refreshTokenCiphertext: true,
      tokenExpiresAt: true,
    },
  });

  if (!account?.accessTokenCiphertext) {
    throw new DiscordAccessError(
      401,
      'OAUTH_REAUTH_REQUIRED',
      'Reconnect Discord to load your servers.',
    );
  }

  const scopes = Array.isArray(account.scopes)
    ? account.scopes.filter((scope): scope is string => typeof scope === 'string')
    : [];
  if (!scopes.includes('guilds')) {
    throw new DiscordAccessError(
      403,
      'OAUTH_SCOPE_REQUIRED',
      'Reconnect Discord and approve server access to continue.',
    );
  }

  let accessToken: string;
  try {
    accessToken = decryptOAuthToken(
      account.accessTokenCiphertext,
      config.oauthTokenEncryptionKey,
    );
  } catch {
    throw new DiscordAccessError(
      401,
      'OAUTH_REAUTH_REQUIRED',
      'Reconnect Discord to refresh your server access.',
    );
  }

  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() > Date.now() + 30_000) {
    return accessToken;
  }

  if (!account.refreshTokenCiphertext) {
    throw new DiscordAccessError(
      401,
      'OAUTH_REAUTH_REQUIRED',
      'Reconnect Discord to refresh your server access.',
    );
  }

  try {
    const refreshToken = decryptOAuthToken(
      account.refreshTokenCiphertext,
      config.oauthTokenEncryptionKey,
    );
    const refreshed = await refreshDiscordAccessToken(refreshToken, config);
    const refreshedScopes = refreshed.scopes.includes('guilds') ? refreshed.scopes : scopes;

    await prisma.oAuthAccount.update({
      where: { id: account.id },
      data: {
        accessTokenCiphertext: encryptOAuthToken(
          refreshed.accessToken,
          config.oauthTokenEncryptionKey,
        ),
        refreshTokenCiphertext: encryptOAuthToken(
          refreshed.refreshToken,
          config.oauthTokenEncryptionKey,
        ),
        tokenExpiresAt: refreshed.tokenExpiresAt,
        scopes: refreshedScopes,
      },
    });

    return refreshed.accessToken;
  } catch {
    throw new DiscordAccessError(
      401,
      'OAUTH_REAUTH_REQUIRED',
      'Reconnect Discord to refresh your server access.',
    );
  }
}

export async function getManageableDiscordGuilds(
  accessToken: string,
): Promise<DiscordGuildAccess[]> {
  let response: Response;
  try {
    response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new DiscordAccessError(
      502,
      'DISCORD_API_ERROR',
      'Discord server access could not be verified.',
    );
  }

  if (!response.ok) {
    throw new DiscordAccessError(
      502,
      'DISCORD_API_ERROR',
      'Discord server access could not be verified.',
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new DiscordAccessError(
      502,
      'DISCORD_API_ERROR',
      'Discord returned an invalid server list.',
    );
  }

  const parsed = z.array(discordGuildSchema).max(5000).safeParse(body);
  if (!parsed.success) {
    throw new DiscordAccessError(
      502,
      'DISCORD_API_ERROR',
      'Discord returned an invalid server list.',
    );
  }

  return parsed.data.filter((guild) => {
    const permissions = BigInt(guild.permissions);
    const administrator = (permissions & 0x8n) === 0x8n;
    const manageGuild = (permissions & 0x20n) === 0x20n;
    return guild.owner === true || administrator || manageGuild;
  });
}
