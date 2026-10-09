import type { DiscordOAuthConfig } from "@vreeo/config";
import type { DiscordOAuthGuild, DiscordOAuthIdentity, DiscordOAuthProvider, DiscordOAuthToken } from "./types.js";
const API_BASE = "https://discord.com/api/v10";
const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = API_BASE + "/oauth2/token";
type OAuthStage = "TOKEN_EXCHANGE" | "IDENTITY_LOOKUP" | "GUILD_DISCOVERY";
export class DiscordOAuthProviderError extends Error {
 constructor(readonly stage: OAuthStage) { super("Discord OAuth request failed."); this.name = "DiscordOAuthProviderError"; }
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
async function parseResponse(response: Response, stage: OAuthStage): Promise<Record<string, unknown>> {
 if (!response.ok) throw new DiscordOAuthProviderError(stage);
 let value: unknown;
 try { value = await response.json(); } catch { throw new DiscordOAuthProviderError(stage); }
 if (!isRecord(value)) throw new DiscordOAuthProviderError(stage);
 return value;
}
function parseGuild(value: unknown): DiscordOAuthGuild {
 if (!isRecord(value) || typeof value.id !== "string" || !/^\d{1,32}$/.test(value.id) ||
  typeof value.name !== "string" || value.name.length === 0 ||
  !(typeof value.icon === "string" || value.icon === null) || typeof value.owner !== "boolean" ||
  typeof value.permissions !== "string" || !/^\d{1,24}$/.test(value.permissions)) throw new DiscordOAuthProviderError("GUILD_DISCOVERY");
 return { id: value.id, name: value.name.slice(0, 200), icon: value.icon, owner: value.owner, permissions: value.permissions };
}
export class DiscordOAuthHttpProvider implements DiscordOAuthProvider {
 constructor(private readonly config: DiscordOAuthConfig, private readonly fetchImpl: typeof fetch = fetch) {}
 buildAuthorizationUrl(state: string, codeChallenge?: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", this.config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", this.config.redirectUri);
  url.searchParams.set("scope", "identify guilds");
  url.searchParams.set("state", state);
  if (codeChallenge) { url.searchParams.set("code_challenge", codeChallenge); url.searchParams.set("code_challenge_method", "S256"); }
  return url.toString();
 }
 async exchangeCode(code: string, codeVerifier?: string): Promise<DiscordOAuthToken> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: this.config.redirectUri });
  if (codeVerifier) body.set("code_verifier", codeVerifier);
  const authorization = Buffer.from(this.config.clientId + ":" + this.config.clientSecret).toString("base64");
  let response: Response;
  try { response = await this.fetchImpl(TOKEN_URL, { method: "POST", headers: { authorization: "Basic " + authorization, "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body, signal: AbortSignal.timeout(10000) }); }
  catch { throw new DiscordOAuthProviderError("TOKEN_EXCHANGE"); }
  const value = await parseResponse(response, "TOKEN_EXCHANGE");
  if (typeof value.access_token !== "string" || typeof value.scope !== "string") throw new DiscordOAuthProviderError("TOKEN_EXCHANGE");
  return { accessToken: value.access_token, scopes: value.scope.split(" ").filter(Boolean) };
 }
 async fetchIdentity(accessToken: string): Promise<DiscordOAuthIdentity> {
  let response: Response;
  try { response = await this.fetchImpl(API_BASE + "/users/@me", { headers: { authorization: "Bearer " + accessToken, accept: "application/json" }, signal: AbortSignal.timeout(10000) }); }
  catch { throw new DiscordOAuthProviderError("IDENTITY_LOOKUP"); }
  const value = await parseResponse(response, "IDENTITY_LOOKUP");
  if (typeof value.id !== "string" || !/^\d{1,32}$/.test(value.id) || typeof value.username !== "string" || value.username.length === 0) throw new DiscordOAuthProviderError("IDENTITY_LOOKUP");
  return { id: value.id, username: value.username.slice(0, 100),
   ...(typeof value.global_name === "string" || value.global_name === null ? { global_name: value.global_name } : {}),
   ...(typeof value.avatar === "string" || value.avatar === null ? { avatar: value.avatar } : {}),
   ...(typeof value.locale === "string" || value.locale === null ? { locale: value.locale } : {}) };
 }
 async fetchGuilds(accessToken: string): Promise<DiscordOAuthGuild[]> {
  const guilds: DiscordOAuthGuild[] = [];
  let after: string | undefined;
  for (let page = 0; page < 20; page += 1) {
   const url = new URL(API_BASE + "/users/@me/guilds");
   url.searchParams.set("limit", "200");
   if (after) url.searchParams.set("after", after);
   let response: Response;
   try { response = await this.fetchImpl(url, { headers: { authorization: "Bearer " + accessToken, accept: "application/json" }, signal: AbortSignal.timeout(10000) }); }
   catch { throw new DiscordOAuthProviderError("GUILD_DISCOVERY"); }
   if (!response.ok) throw new DiscordOAuthProviderError("GUILD_DISCOVERY");
   let payload: unknown;
   try { payload = await response.json(); } catch { throw new DiscordOAuthProviderError("GUILD_DISCOVERY"); }
   if (!Array.isArray(payload)) throw new DiscordOAuthProviderError("GUILD_DISCOVERY");
   const batch = payload.map(parseGuild);
   guilds.push(...batch);
   if (batch.length < 200) return guilds;
   const lastId = batch.at(-1)?.id;
   if (!lastId || lastId === after) throw new DiscordOAuthProviderError("GUILD_DISCOVERY");
   after = lastId;
  }
  throw new DiscordOAuthProviderError("GUILD_DISCOVERY");
 }
}
