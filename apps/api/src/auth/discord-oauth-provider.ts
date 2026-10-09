import type { DiscordOAuthConfig } from "@vreeo/config";
import type { DiscordOAuthGuild, DiscordOAuthIdentity, DiscordOAuthProvider, DiscordOAuthToken } from "./types.js";
const API_BASE = "https://discord.com/api/v10";
const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = `${API_BASE}/oauth2/token`;
export class DiscordOAuthProviderError extends Error {
  constructor(readonly stage: "TOKEN_EXCHANGE" | "IDENTITY_LOOKUP" | "GUILD_DISCOVERY") { super("Discord OAuth request failed."); this.name = "DiscordOAuthProviderError"; }
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
async function parseResponse(response: Response, stage: DiscordOAuthProviderError["stage"]): Promise<Record<string, unknown>> {
  if (!response.ok) throw new DiscordOAuthProviderError(stage);
  let value: unknown;
  try { value = await response.json(); } catch { throw new DiscordOAuthProviderError(stage); }
  if (!isRecord(value)) throw new DiscordOAuthProviderError(stage);
  return value;
}
export class DiscordOAuthHttpProvider implements DiscordOAuthProvider {
  constructor(private readonly config: DiscordOAuthConfig) {}
  buildAuthorizationUrl(state: string, codeChallenge?: string): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("scope", "identify guilds");
    url.searchParams.set("state", state);
    if (codeChallenge) {
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  }
  async exchangeCode(code: string, codeVerifier?: string): Promise<DiscordOAuthToken> {
    const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: this.config.redirectUri });
    if (codeVerifier) body.set("code_verifier", codeVerifier);
    const authorization = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    let response: Response;
    try {
      response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { authorization: `Basic ${authorization}`, "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body, signal: AbortSignal.timeout(10_000),
      });
    } catch { throw new DiscordOAuthProviderError("TOKEN_EXCHANGE"); }
    const value = await parseResponse(response, "TOKEN_EXCHANGE");
    if (typeof value.access_token !== "string" || typeof value.scope !== "string") throw new DiscordOAuthProviderError("TOKEN_EXCHANGE");
    return { accessToken: value.access_token, scopes: value.scope.split(" ").filter(Boolean) };
  }
  async fetchGuilds(accessToken: string): Promise<DiscordOAuthGuild[]> {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/users/@me/guilds`, {
        headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch { throw new DiscordOAuthProviderError("GUILD_DISCOVERY"); }
    if (!response.ok) throw new DiscordOAuthProviderError("GUILD_DISCOVERY");
    let value: unknown;
    try { value = await response.json(); } catch { throw new DiscordOAuthProviderError("GUILD_DISCOVERY"); }
    if (!Array.isArray(value) || value.length > 10_000 || !value.every(isDiscordOAuthGuild)) {
      throw new DiscordOAuthProviderError("GUILD_DISCOVERY");
    }
    const ids = new Set<string>();
    for (const guild of value) {
      if (ids.has(guild.id)) throw new DiscordOAuthProviderError("GUILD_DISCOVERY");
      ids.add(guild.id);
    }
    return value;
  }

  async fetchIdentity(accessToken: string): Promise<DiscordOAuthIdentity> {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/users/@me`, {
        headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch { throw new DiscordOAuthProviderError("IDENTITY_LOOKUP"); }
    const value = await parseResponse(response, "IDENTITY_LOOKUP");
    if (typeof value.id !== "string" || value.id.length === 0 || value.id.length > 32 ||
      typeof value.username !== "string" || value.username.length === 0) throw new DiscordOAuthProviderError("IDENTITY_LOOKUP");
    return {
      id: value.id, username: value.username.slice(0, 100),
      ...(typeof value.global_name === "string" || value.global_name === null ? { global_name: value.global_name } : {}),
      ...(typeof value.avatar === "string" || value.avatar === null ? { avatar: value.avatar } : {}),
      ...(typeof value.locale === "string" || value.locale === null ? { locale: value.locale } : {}),
    };
  }
}

function isDiscordOAuthGuild(value: unknown): value is DiscordOAuthGuild {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && /^\d{1,32}$/.test(value.id) &&
    typeof value.name === "string" && value.name.length > 0 && value.name.length <= 100 &&
    (typeof value.icon === "string" && /^[A-Za-z0-9_]{1,128}$/.test(value.icon) || value.icon === null) &&
    typeof value.owner === "boolean" &&
    typeof value.permissions === "string" && /^\d{1,32}$/.test(value.permissions);
}

