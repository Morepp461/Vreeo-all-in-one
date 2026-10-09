import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ApiConfig } from "@vreeo/config";
import { AuthRepositoryError, type AuthRouteDependencies, type AuthSessionRecord, type AuthSessionWithUser } from "./types.js";
const OAUTH_STATE_TTL_SECONDS = 300;
const OAUTH_STATE_COOKIE_NAME = "vreeo_oauth_state";
const OAUTH_STATE_COOKIE_PATH = "/api/v1/auth/discord/callback";
const statePattern = /^[A-Za-z0-9_-]{43}$/;
const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function sessionHash(raw: string): string { return createHash("sha256").update(raw).digest("hex"); }
function secureEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function cookieOptions(config: ApiConfig) {
  return { path: "/", httpOnly: true, secure: config.sessionCookieSecure, sameSite: config.sessionCookieSameSite } as const;
}
function stateCookieOptions(config: ApiConfig) {
  return { path: OAUTH_STATE_COOKIE_PATH, httpOnly: true, secure: config.sessionCookieSecure, sameSite: "lax" as const };
}
function sendError(reply: FastifyReply, requestId: string, statusCode: number, code: string, message: string) {
  return reply.code(statusCode).header("Cache-Control", "no-store").send({ error: { code, message, requestId } });
}
function hasExpectedOrigin(request: FastifyRequest, config: ApiConfig): boolean {
  const origin = request.headers.origin;
  if (typeof origin !== "string") return false;
  try { return new URL(origin).origin === new URL(config.appBaseUrl).origin; } catch { return false; }
}
export async function resolveAuthenticatedSession(request: FastifyRequest, dependencies: AuthRouteDependencies): Promise<AuthSessionWithUser | null> {
  const raw = request.cookies[dependencies.config.sessionCookieName];
  if (!raw || raw.length > 256) return null;
  const now = new Date();
  const result = await dependencies.repository.findActiveSessionByHash(sessionHash(raw), now);
  if (!result) return null;
  await dependencies.repository.touchSession(result.session.id, now);
  return result;
}
function safeSession(session: AuthSessionRecord, currentId: string) {
  return {
    id: session.id, createdAt: session.createdAt.toISOString(), expiresAt: session.expiresAt.toISOString(),
    lastSeenAt: session.lastSeenAt.toISOString(), revokedAt: session.revokedAt?.toISOString() ?? null,
    current: session.id === currentId,
  };
}
export async function registerAuthRoutes(app: FastifyInstance, dependencies: AuthRouteDependencies): Promise<void> {
  const { config, repository, stateStore } = dependencies;
  app.get("/api/v1/auth/discord", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    if (!config.discordOAuth || !dependencies.provider) return sendError(reply, request.id, 503, "SERVICE_UNAVAILABLE", "Discord login is not configured.");
    const state = randomBytes(32).toString("base64url");
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    if (!await stateStore.issue(state, OAUTH_STATE_TTL_SECONDS, codeVerifier)) return sendError(reply, request.id, 503, "SERVICE_UNAVAILABLE", "Authentication could not be started.");
    reply.setCookie(OAUTH_STATE_COOKIE_NAME, state, { ...stateCookieOptions(config), maxAge: OAUTH_STATE_TTL_SECONDS });
    return reply.redirect(dependencies.provider.buildAuthorizationUrl(state, codeChallenge), 302);
  });
  app.get("/api/v1/auth/discord/callback", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    if (!config.discordOAuth || !dependencies.provider) return sendError(reply, request.id, 503, "SERVICE_UNAVAILABLE", "Discord login is not configured.");
    const query = request.query as Record<string, unknown>;
    const code = typeof query.code === "string" && query.code.length <= 2_048 ? query.code : "";
    const state = typeof query.state === "string" ? query.state : "";
    const stateCookie = request.cookies[OAUTH_STATE_COOKIE_NAME];
    if (!statePattern.test(state) || !stateCookie || !secureEquals(stateCookie, state)) {
      reply.clearCookie(OAUTH_STATE_COOKIE_NAME, stateCookieOptions(config));
      return sendError(reply, request.id, 400, "OAUTH_STATE_INVALID", "The authentication request is invalid or expired.");
    }
    const codeVerifier = await stateStore.consume(state);
    reply.clearCookie(OAUTH_STATE_COOKIE_NAME, stateCookieOptions(config));
    if (typeof codeVerifier !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(codeVerifier)) {
      return sendError(reply, request.id, 400, "OAUTH_STATE_INVALID", "The authentication request is invalid or expired.");
    }
    if (typeof query.error === "string") return reply.redirect(new URL("/login?error=oauth_denied", config.appBaseUrl).toString(), 303);
    if (!code) return sendError(reply, request.id, 400, "AUTH_INVALID", "Discord did not return a valid authorization code.");
    try {
      const token = await dependencies.provider.exchangeCode(code, codeVerifier);
      const identity = await dependencies.provider.fetchIdentity(token.accessToken);
      const now = new Date();
      const rawSession = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now.getTime() + config.sessionTtlSeconds * 1_000);
      await repository.completeLogin({ identity, scopes: token.scopes, sessionHash: sessionHash(rawSession), sessionExpiresAt: expiresAt, now });
      reply.setCookie(config.sessionCookieName, rawSession, { ...cookieOptions(config), maxAge: config.sessionTtlSeconds, expires: expiresAt });
      return reply.redirect(new URL("/", config.appBaseUrl).toString(), 303);
    } catch (error) {
      if (error instanceof AuthRepositoryError && error.code === "USER_DEACTIVATED") return sendError(reply, request.id, 403, "AUTH_INVALID", "Authentication is not available for this account.");
      request.log.error({ requestId: request.id, errorName: error instanceof Error ? error.name : "UnknownError" }, "Discord OAuth callback failed");
      return sendError(reply, request.id, 502, "SERVICE_UNAVAILABLE", "Discord login could not be completed. Please try again.");
    }
  });
  app.get("/api/v1/auth/me", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const current = await resolveAuthenticatedSession(request, dependencies);
    if (!current) return sendError(reply, request.id, 401, "AUTH_REQUIRED", "Please sign in to continue.");
    return { data: { id: current.user.id, discordUserId: current.user.discordUserId, username: current.user.username, locale: current.user.locale } };
  });
  app.post("/api/v1/auth/logout", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const raw = request.cookies[config.sessionCookieName];
    if (raw && !hasExpectedOrigin(request, config)) return sendError(reply, request.id, 403, "FORBIDDEN", "The request origin is not allowed.");
    if (raw && raw.length <= 256) await repository.revokeByHash(sessionHash(raw), new Date());
    reply.clearCookie(config.sessionCookieName, cookieOptions(config));
    return reply.code(204).send();
  });
  app.get("/api/v1/auth/sessions", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const current = await resolveAuthenticatedSession(request, dependencies);
    if (!current) return sendError(reply, request.id, 401, "AUTH_REQUIRED", "Please sign in to continue.");
    return { data: (await repository.listSessions(current.user.id, 50)).map((session) => safeSession(session, current.session.id)) };
  });
  app.delete("/api/v1/auth/sessions/:sessionId", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const current = await resolveAuthenticatedSession(request, dependencies);
    if (!current) return sendError(reply, request.id, 401, "AUTH_REQUIRED", "Please sign in to continue.");
    if (!hasExpectedOrigin(request, config)) return sendError(reply, request.id, 403, "FORBIDDEN", "The request origin is not allowed.");
    const params = request.params as { sessionId?: unknown };
    if (typeof params.sessionId !== "string" || !sessionIdPattern.test(params.sessionId)) return sendError(reply, request.id, 400, "VALIDATION_ERROR", "The session ID is invalid.");
    if (!await repository.revokeSession(current.user.id, params.sessionId, new Date())) return sendError(reply, request.id, 404, "RESOURCE_NOT_FOUND", "The session was not found.");
    if (params.sessionId === current.session.id) reply.clearCookie(config.sessionCookieName, cookieOptions(config));
    return reply.code(204).send();
  });
}
