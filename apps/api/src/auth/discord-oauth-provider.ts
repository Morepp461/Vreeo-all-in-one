import type { DiscordOAuthConfig } from "@vreeo/config";
import type { DiscordOAuthIdentity, DiscordOAuthProvider, DiscordOAuthToken } from "./types.js";
const API_BASE = "https://discord.com/api/v10";
const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = `${API_BASE}/oauth2/token`;
export class DiscordOAuthProviderError extends Error {
  constructor(readonly stage: "TOKEN_EXCHANGE" | "IDENTITY_LOOKUP") { super("Discord OAuth request failed."); this.name = "DiscordOAuthProviderError"; }
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
