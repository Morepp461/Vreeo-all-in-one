import type { ApiConfig } from "@vreeo/config";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import type { AuthRepository, AuthSessionRecord, AuthSessionWithUser, AuthUserRecord, CompleteLoginInput, DiscordOAuthProvider, OAuthStateStore } from "./types.js";

const config: ApiConfig = {
  nodeEnv: "test", logLevel: "silent", apiHost: "127.0.0.1", apiPort: 3001,
  databaseUrl: "postgresql://vreeo:vreeo_dev_only@localhost:5432/vreeo?schema=public",
  redisUrl: "redis://127.0.0.1:6379",
  discordOAuth: { clientId: "client-id", clientSecret: "test-secret", redirectUri: "http://localhost:3001/api/v1/auth/discord/callback" },
  appBaseUrl: "http://localhost:3000", sessionTtlSeconds: 3_600,
  sessionCookieName: "vreeo_session", sessionCookieSameSite: "lax", sessionCookieSecure: false,
};
class MemoryStateStore implements OAuthStateStore {
  readonly values = new Map<string, string>();
  async issue(state: string, _ttlSeconds: number, verifier?: string): Promise<boolean> {
    this.values.set(state, verifier ?? "test-verifier");
    return true;
  }
  async consume(state: string): Promise<string | null> {
    const verifier = this.values.get(state);
    this.values.delete(state);
    return verifier ?? null;
  }
}
class MemoryAuthRepository implements AuthRepository {
  readonly user: AuthUserRecord = {
    id: "user-internal-1", discordUserId: "123456789012345678", username: "example",
    displayName: "Example", locale: "en", deletedAt: null,
  };
  session: AuthSessionRecord | null = null;
  storedHash = "";
  guildSnapshot: CompleteLoginInput["guilds"] = [];
  revoked = false;
  accessibleGuilds = [{
    id: "internal-guild-1",
    discordGuildId: "222222222222222222",
    name: "VREEO Test Guild",
    iconUrl: "",
    ownerDiscordUserId: "123456789012345678",
  }];
  async listAccessibleGuilds(userId: string) {
    return userId === this.user.id ? this.accessibleGuilds : [];
  }
  async completeLogin(input: CompleteLoginInput) {
    this.storedHash = input.sessionHash;
    this.guildSnapshot = input.guilds;
    this.session = {
      id: "11111111-1111-4111-8111-111111111111", userId: this.user.id,
      createdAt: input.now, expiresAt: input.sessionExpiresAt, revokedAt: null, lastSeenAt: input.now,
    };
    return { user: this.user, session: this.session };
  }
  async findActiveSessionByHash(hash: string, at: Date): Promise<AuthSessionWithUser | null> {
    const session = this.session;
    if (hash !== this.storedHash || !session || this.revoked || session.expiresAt <= at) return null;
    return { user: this.user, session };
  }
  async touchSession(sessionId: string, at: Date): Promise<void> {
    if (this.session?.id === sessionId) this.session.lastSeenAt = at;
  }
  async revokeByHash(hash: string, at: Date): Promise<void> {
    if (hash === this.storedHash && this.session) {
      this.revoked = true;
      this.session.revokedAt = at;
    }
  }
  async listSessions(_userId: string, _limit: number): Promise<AuthSessionRecord[]> {
    return this.session ? [this.session] : [];
  }
  async revokeSession(userId: string, sessionId: string, at: Date): Promise<boolean> {
    if (userId !== this.user.id || this.session?.id !== sessionId || this.revoked) return false;
    this.revoked = true;
    this.session.revokedAt = at;
    return true;
  }
}
function setup() {
  const stateStore = new MemoryStateStore();
  const repository = new MemoryAuthRepository();
  const provider: DiscordOAuthProvider = {
    buildAuthorizationUrl: (state, challenge) => `https://discord.com/oauth2/authorize?state=${state}&client_id=client-id&code_challenge=${challenge}&code_challenge_method=S256`,
    exchangeCode: async (code, verifier) => {
      if (code !== "valid-code" || !/^[A-Za-z0-9_-]{43}$/.test(verifier ?? "")) throw new Error("provider error");
      return { accessToken: "temporary-token", scopes: ["identify", "guilds"] };
    },
    fetchIdentity: async (token) => {
      if (token !== "temporary-token") throw new Error("provider error");
      return { id: "123456789012345678", username: "example", global_name: "Example", locale: "en" };
    },
    fetchGuilds: async (token) => {
      if (token !== "temporary-token") throw new Error("provider error");
      return [
        { id: "222222222222222222", name: "VREEO Test Guild", icon: null, owner: true, permissions: "8" },
        { id: "333333333333333333", name: "Read Only Guild", icon: null, owner: false, permissions: "1024" },
      ];
    },
  };
  return { stateStore, repository, provider, auth: { config, stateStore, repository, provider } };
}
function cookiePair(value: string | string[] | undefined, name: string): string | undefined {
  const cookies = Array.isArray(value) ? value : value ? [value] : [];
  return cookies.find((item) => item.startsWith(`${name}=`))?.split(";")[0];
}

describe("OAuth and session routes", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => { await app?.close(); app = undefined; });

  it("validates browser-bound OAuth state and PKCE, creates an opaque session, and serves current user", async () => {
    const deps = setup();
    app = await buildServer({ loggerOptions: { level: "silent" }, auth: deps.auth });
    const start = await app.inject({ method: "GET", url: "/api/v1/auth/discord" });
    expect(start.statusCode).toBe(302);
    const location = new URL(start.headers.location as string);
    const state = location.searchParams.get("state") ?? "";
    const stateCookie = cookiePair(start.headers["set-cookie"], "vreeo_oauth_state");
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stateCookie).toBe(`vreeo_oauth_state=${state}`);
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const callback = await app.inject({
      method: "GET",
      url: `/api/v1/auth/discord/callback?code=valid-code&state=${state}`,
      headers: { cookie: stateCookie },
    });
    expect(callback.statusCode).toBe(303);
    expect(callback.headers.location).toBe("http://localhost:3000/");
    const sessionCookie = cookiePair(callback.headers["set-cookie"], "vreeo_session");
    expect(sessionCookie).toMatch(/^vreeo_session=[A-Za-z0-9_-]{43}$/);
    expect(deps.repository.guildSnapshot).toHaveLength(2);
    expect(callback.headers["set-cookie"]?.toString()).toContain("HttpOnly");
    expect(callback.headers["set-cookie"]?.toString()).toContain("SameSite=Lax");

    const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: sessionCookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().data).toEqual({
      id: "user-internal-1", discordUserId: "123456789012345678", username: "example", locale: "en",
    });
  });

  it("requires a session and only returns guilds scoped to the authenticated user", async () => {
    const deps = setup();
    app = await buildServer({ loggerOptions: { level: "silent" }, auth: deps.auth });
    const anonymous = await app.inject({ method: "GET", url: "/api/v1/guilds" });
    expect(anonymous.statusCode).toBe(401);

    const start = await app.inject({ method: "GET", url: "/api/v1/auth/discord" });
    const state = new URL(start.headers.location as string).searchParams.get("state") ?? "";
    const stateCookie = cookiePair(start.headers["set-cookie"], "vreeo_oauth_state");
    const callback = await app.inject({
      method: "GET", url: `/api/v1/auth/discord/callback?code=valid-code&state=${state}`,
      headers: { cookie: stateCookie },
    });
    const sessionCookie = cookiePair(callback.headers["set-cookie"], "vreeo_session");
    const response = await app.inject({ method: "GET", url: "/api/v1/guilds", headers: { cookie: sessionCookie } });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json().data).toEqual([{
      id: "internal-guild-1",
      discordGuildId: "222222222222222222",
      name: "VREEO Test Guild",
      iconUrl: "",
      ownerDiscordUserId: "123456789012345678",
    }]);
  });

  it("rejects state not bound to the initiating browser, invalid state, and replay", async () => {
    const deps = setup();
    app = await buildServer({ loggerOptions: { level: "silent" }, auth: deps.auth });
    const start = await app.inject({ method: "GET", url: "/api/v1/auth/discord" });
    const state = new URL(start.headers.location as string).searchParams.get("state") ?? "";
    const stateCookie = cookiePair(start.headers["set-cookie"], "vreeo_oauth_state");
    const missingBrowserCookie = await app.inject({
      method: "GET", url: `/api/v1/auth/discord/callback?code=valid-code&state=${state}`,
    });
    expect(missingBrowserCookie.statusCode).toBe(400);
    expect(missingBrowserCookie.json().error.code).toBe("OAUTH_STATE_INVALID");

    const callback = await app.inject({
      method: "GET", url: `/api/v1/auth/discord/callback?code=valid-code&state=${state}`,
      headers: { cookie: stateCookie },
    });
    expect(callback.statusCode).toBe(303);
    const replay = await app.inject({
      method: "GET", url: `/api/v1/auth/discord/callback?code=valid-code&state=${state}`,
      headers: { cookie: stateCookie },
    });
    expect(replay.statusCode).toBe(400);
    expect(replay.json().error.code).toBe("OAUTH_STATE_INVALID");
  });

  it("enforces same-origin logout and revokes the session", async () => {
    const deps = setup();
    app = await buildServer({ loggerOptions: { level: "silent" }, auth: deps.auth });
    const start = await app.inject({ method: "GET", url: "/api/v1/auth/discord" });
    const state = new URL(start.headers.location as string).searchParams.get("state") ?? "";
    const stateCookie = cookiePair(start.headers["set-cookie"], "vreeo_oauth_state");
    const callback = await app.inject({
      method: "GET", url: `/api/v1/auth/discord/callback?code=valid-code&state=${state}`,
      headers: { cookie: stateCookie },
    });
    const sessionCookie = cookiePair(callback.headers["set-cookie"], "vreeo_session");
    const blocked = await app.inject({
      method: "POST", url: "/api/v1/auth/logout",
      headers: { cookie: sessionCookie, origin: "https://evil.example" },
    });
    expect(blocked.statusCode).toBe(403);
    expect(deps.repository.revoked).toBe(false);

    const logout = await app.inject({
      method: "POST", url: "/api/v1/auth/logout",
      headers: { cookie: sessionCookie, origin: "http://localhost:3000" },
    });
    expect(logout.statusCode).toBe(204);
    expect(deps.repository.revoked).toBe(true);
    expect(logout.headers["set-cookie"]?.toString()).toContain("Max-Age=0");
  });

  it("does not reveal session hashes in the session list", async () => {
    const deps = setup();
    app = await buildServer({ loggerOptions: { level: "silent" }, auth: deps.auth });
    const start = await app.inject({ method: "GET", url: "/api/v1/auth/discord" });
    const state = new URL(start.headers.location as string).searchParams.get("state") ?? "";
    const stateCookie = cookiePair(start.headers["set-cookie"], "vreeo_oauth_state");
    const callback = await app.inject({
      method: "GET", url: `/api/v1/auth/discord/callback?code=valid-code&state=${state}`,
      headers: { cookie: stateCookie },
    });
    const sessionCookie = cookiePair(callback.headers["set-cookie"], "vreeo_session");
    const sessions = await app.inject({ method: "GET", url: "/api/v1/auth/sessions", headers: { cookie: sessionCookie } });
    expect(sessions.statusCode).toBe(200);
    expect(sessions.json().data[0]).toMatchObject({ current: true, id: "11111111-1111-4111-8111-111111111111" });
    expect(sessions.body).not.toContain("sessionHash");
  });
});
