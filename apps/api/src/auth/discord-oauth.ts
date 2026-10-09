import { z } from 'zod';

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token: z.string().optional(),
  scope: z.string().default('identify'),
});

const discordUserSchema = z.object({
  id: z.string().regex(/^\d{1,32}$/),
  username: z.string().min(1).max(100),
  global_name: z.string().max(100).nullable().optional(),
  avatar: z.string().nullable().optional(),
  locale: z.string().max(10).optional(),
});

export class DiscordOAuthError extends Error {
  constructor(message = 'Discord authentication could not be completed.') {
    super(message);
    this.name = 'DiscordOAuthError';
  }
}

export async function exchangeDiscordCode(
  code: string,
  config: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  },
) {
  try {
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!tokenResponse.ok) throw new DiscordOAuthError();

    const tokenParsed = tokenResponseSchema.safeParse(await tokenResponse.json());
    if (!tokenParsed.success) throw new DiscordOAuthError();

    const token = tokenParsed.data;
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `${token.token_type} ${token.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!userResponse.ok) throw new DiscordOAuthError();

    const userParsed = discordUserSchema.safeParse(await userResponse.json());
    if (!userParsed.success) throw new DiscordOAuthError();

    return {
      user: userParsed.data,
      scopes: token.scope.split(' ').filter(Boolean),
    };
  } catch (error) {
    if (error instanceof DiscordOAuthError) throw error;
    throw new DiscordOAuthError();
  }
}
