import { createHash } from "node:crypto";
import type { ApiConfig } from "@vreeo/config";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "../server.js";
import type { AuthRepository, AuthSessionRecord, AuthSessionWithUser, AuthUserRecord, CompleteLoginInput, OAuthStateStore } from "../auth/types.js";
import type { AccessibleGuild, GuildAccessRepository, GuildContextLookup } from "./types.js";
import { hasManageGuildPermission } from "./prisma-guild-access-repository.js";

const config: ApiConfig = {
  nodeEnv: "test", logLevel: "silent", apiHost: "127.0.0.1", apiPort: 3001,
  databaseUrl: "postgresql://vreeo:vreeo_dev_only@localhost:5432/vreeo?schema=public",
  redisUrl: "redis://127.0.0.1:6379", discordOAuth: null,
  appBaseUrl: "http://localhost:3000", sessionTtlSeconds: 3_600,
  sessionCookieName: "vreeo_session", sessionCookieSameSite: "lax", sessionCookieSecure: false,
};
const rawSession = "a".repeat(43);
const user: AuthUserRecord = {
  id: "user-internal-1", discordUserId: "123456789012345678", username: "example",
  displayName: "Example", locale: "en", deletedAt: null,
};
const activeSession: AuthSessionRecord = {
  id: "11111111-1111-4111-8111-111111111111", userId: user.id,
  createdAt: new Date("2026-01-01T00:00:00Z"), expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null, lastSeenAt: new Date("2026-01-01T00:00:00Z"),
};
class TestAuthRepository implements AuthRepository {
  async completeLogin(_input: CompleteLoginInput) { return { user, session: activeSession }; }
  async findActiveSessionByHash(hash: string, now: Date): Promise<AuthSessionWithUser | null> {
    if (hash !== createHash("sha256").update(rawSession).digest("hex") || activeSession.expiresAt <= now) return null;
    return { user, session: activeSession };
  }
  async touchSession() {}
  async revokeByHash() {}
  async listSessions() { return [activeSession]; }
  async revokeSession() { return false; }
}
class TestStateStore implements OAuthStateStore {
  async issue() { return true; }
  async consume() { return null; }
}
const expectedGuilds: AccessibleGuild[] = [
  { id: "internal-guild-1", discordGuildId: "222222222222222222", name: "Example Guild", iconUrl: "", accessLevel: "manage_guild" },
];
function setup() {
  const auth = { config, repository: new TestAuthRepository(), stateStore: new TestStateStore(), provider: null };
  const repository: GuildAccessRepository = {
    listManageableGuilds: vi.fn(async () => expectedGuilds),
    resolveGuildContext: vi.fn(async (discordGuildId: string, discordUserId: string): Promise<GuildContextLookup> => {
      if (discordUserId !== user.discordUserId) return { status: "forbidden" };
      if (discordGuildId === "333333333333333333") return { status: "forbidden" };
      if (discordGuildId !== "222222222222222222") return { status: "not_found" };
      return {
        status: "ok",
        guild: {
          guildId: "internal-guild-1",
          discordGuildId,
          name: "Example Guild",
          iconUrl: "",
          isOwner: false,
          roleIds: ["role-moderator"],
        },
      };
    }),
  };
  return { auth, repository };
}

describe("guild access discovery", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => { await app?.close(); app = undefined; });

  it("requires an active session and does not expose guilds anonymously", async () => {
    const deps = setup();
    app = await buildServer({ loggerOptions: { level: "silent" }, guilds: { auth: deps.auth, repository: deps.repository } });
    const response = await app.inject({ method: "GET", url: "/api/v1/guilds" });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("AUTH_REQUIRED");
    expect(deps.repository.listManageableGuilds).not.toHaveBeenCalled();
  });

  it("lists only repository-approved guilds for the authenticated Discord identity", async () => {
    const deps = setup();
    app = await buildServer({ loggerOptions: { level: "silent" }, guilds: { auth: deps.auth, repository: deps.repository } });
    const response = await app.inject({
      method: "GET", url: "/api/v1/guilds", headers: { cookie: `vreeo_session=${rawSession}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toEqual({ data: expectedGuilds });
    expect(deps.repository.listManageableGuilds).toHaveBeenCalledWith(user.discordUserId);
  });

  it("attaches server-resolved guild context only after session and live-snapshot access checks", async () => {
    const deps = setup();
    app = await buildServer({ loggerOptions: { level: "silent" }, guilds: { auth: deps.auth, repository: deps.repository } });
    const response = await app.inject({
      method: "GET", url: "/api/v1/guilds/222222222222222222/context",
      headers: { cookie: `vreeo_session=${rawSession}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toEqual({
      data: { guildId: "222222222222222222", name: "Example Guild", iconUrl: "", accessLevel: "manage_guild" },
    });
    expect(deps.repository.resolveGuildContext).toHaveBeenCalledWith("222222222222222222", user.discordUserId);
  });

  it("rejects malformed, unavailable, and non-manageable guild contexts", async () => {
    const deps = setup();
    app = await buildServer({ loggerOptions: { level: "silent" }, guilds: { auth: deps.auth, repository: deps.repository } });
    const headers = { cookie: `vreeo_session=${rawSession}` };
    const malformed = await app.inject({ method: "GET", url: "/api/v1/guilds/not-a-snowflake/context", headers });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error.code).toBe("VALIDATION_ERROR");
    const missing = await app.inject({ method: "GET", url: "/api/v1/guilds/444444444444444444/context", headers });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("GUILD_NOT_FOUND");
    const forbidden = await app.inject({ method: "GET", url: "/api/v1/guilds/333333333333333333/context", headers });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe("GUILD_ACCESS_DENIED");
  });

  it("does not resolve guild context without a valid session", async () => {
    const deps = setup();
    app = await buildServer({ loggerOptions: { level: "silent" }, guilds: { auth: deps.auth, repository: deps.repository } });
    const response = await app.inject({ method: "GET", url: "/api/v1/guilds/222222222222222222/context" });
    expect(response.statusCode).toBe(401);
    expect(deps.repository.resolveGuildContext).not.toHaveBeenCalled();
  });

  it("fails closed for malformed role permissions and checks Discord bit flags", () => {
    expect(hasManageGuildPermission(["not-a-number", "-1", ""])).toBe(false);
    expect(hasManageGuildPermission(["8"])).toBe(true);
    expect(hasManageGuildPermission(["32"])).toBe(true);
    expect(hasManageGuildPermission(["1048576"])).toBe(false);
  });
});
