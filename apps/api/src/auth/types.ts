import type { ApiConfig } from "@vreeo/config";
export interface DiscordOAuthIdentity { id: string; username: string; global_name?: string | null; avatar?: string | null; locale?: string | null; }
export interface DiscordOAuthGuild { id: string; name: string; icon: string | null; owner: boolean; permissions: string; }
export interface AccessibleGuildRecord { id: string; name: string; iconUrl: string; }
export interface GuildContextRecord { id: string; discordGuildId: string; name: string; iconUrl: string; }
export interface DiscordOAuthToken { accessToken: string; scopes: string[]; }
export interface AuthUserRecord { id: string; discordUserId: string; username: string; displayName: string; locale: string; deletedAt: Date | null; }
export interface AuthSessionRecord { id: string; userId: string; createdAt: Date; expiresAt: Date; revokedAt: Date | null; lastSeenAt: Date; }
export interface AuthSessionWithUser { session: AuthSessionRecord; user: AuthUserRecord; }
export interface CompleteLoginInput { identity: DiscordOAuthIdentity; scopes: string[]; sessionHash: string; sessionExpiresAt: Date; now: Date; manageableGuilds: readonly DiscordOAuthGuild[]; }
export interface AuthRepository {
 completeLogin(input: CompleteLoginInput): Promise<{ user: AuthUserRecord; session: AuthSessionRecord }>;
 findActiveSessionByHash(sessionHash: string, now: Date): Promise<AuthSessionWithUser | null>;
 touchSession(sessionId: string, at: Date): Promise<void>;
 revokeByHash(sessionHash: string, at: Date): Promise<void>;
 listSessions(userId: string, limit: number): Promise<AuthSessionRecord[]>;
 revokeSession(userId: string, sessionId: string, at: Date): Promise<boolean>;
 listAccessibleGuilds(userId: string): Promise<AccessibleGuildRecord[]>;
 getAccessibleGuild(userId: string, discordGuildId: string): Promise<GuildContextRecord | null>;
}
export interface OAuthStateStore { issue(state: string, ttlSeconds: number, codeVerifier?: string): Promise<boolean>; consume(state: string): Promise<string | boolean | null>; }
export interface DiscordOAuthProvider {
 buildAuthorizationUrl(state: string, codeChallenge?: string): string;
 exchangeCode(code: string, codeVerifier?: string): Promise<DiscordOAuthToken>;
 fetchIdentity(accessToken: string): Promise<DiscordOAuthIdentity>;
 fetchGuilds(accessToken: string): Promise<DiscordOAuthGuild[]>;
}
export interface AuthRouteDependencies { config: ApiConfig; repository: AuthRepository; stateStore: OAuthStateStore; provider: DiscordOAuthProvider | null; }
export class AuthRepositoryError extends Error {
 constructor(readonly code: "USER_DEACTIVATED") { super("Authentication is not available for this account."); this.name = "AuthRepositoryError"; }
}
