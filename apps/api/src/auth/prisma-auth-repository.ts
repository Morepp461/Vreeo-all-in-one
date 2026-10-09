import type { PrismaClient } from "@vreeo/database";
import { AuthRepositoryError, type AuthRepository, type AuthSessionRecord, type AuthSessionWithUser, type AuthUserRecord, type CompleteLoginInput, type AccessibleGuildRecord } from "./types.js";
function toUserRecord(user: { id: string; discordUserId: string; username: string; displayName: string; locale: string; deletedAt: Date | null; }): AuthUserRecord {
  return { id: user.id, discordUserId: user.discordUserId, username: user.username, displayName: user.displayName, locale: user.locale, deletedAt: user.deletedAt };
}
function toSessionRecord(session: { id: string; userId: string; createdAt: Date; expiresAt: Date; revokedAt: Date | null; lastSeenAt: Date; }): AuthSessionRecord {
  return { id: session.id, userId: session.userId, createdAt: session.createdAt, expiresAt: session.expiresAt, revokedAt: session.revokedAt, lastSeenAt: session.lastSeenAt };
}
function avatarUrl(discordUserId: string, avatar: string | null | undefined): string {
  if (!avatar) return "";
  return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatar}.${avatar.startsWith("a_") ? "gif" : "png"}`;
}
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async listAccessibleGuilds(userId: string): Promise<AccessibleGuildRecord[]> {
    const memberships = await this.prisma.guildMember.findMany({
      where: {
        userId,
        isMember: true,
        leftAt: null,
        guild: { is: { active: true } },
      },
      select: {
        guild: {
          select: {
            id: true,
            discordGuildId: true,
            name: true,
            iconUrl: true,
            ownerDiscordUserId: true,
          },
        },
      },
      orderBy: { guild: { name: "asc" } },
    });
    return memberships.map(({ guild }) => guild);
  }

  async completeLogin(input: CompleteLoginInput): Promise<{ user: AuthUserRecord; session: AuthSessionRecord }> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { discordUserId: input.identity.id },
        create: {
          discordUserId: input.identity.id, username: input.identity.username,
          displayName: input.identity.global_name || input.identity.username,
          avatarUrl: avatarUrl(input.identity.id, input.identity.avatar),
          locale: input.identity.locale?.slice(0, 10) || "en", lastLoginAt: input.now,
        },
        update: {
          username: input.identity.username, displayName: input.identity.global_name || input.identity.username,
          avatarUrl: avatarUrl(input.identity.id, input.identity.avatar),
          locale: input.identity.locale?.slice(0, 10) || "en", lastLoginAt: input.now,
        },
      });
      if (user.deletedAt) throw new AuthRepositoryError("USER_DEACTIVATED");
      await tx.oAuthAccount.upsert({
        where: { provider_providerAccountId: { provider: "discord", providerAccountId: input.identity.id } },
        create: { userId: user.id, provider: "discord", providerAccountId: input.identity.id, scopes: input.scopes },
        update: { userId: user.id, scopes: input.scopes },
      });
      const session = await tx.session.create({
        data: { userId: user.id, sessionHash: input.sessionHash, expiresAt: input.sessionExpiresAt, lastSeenAt: input.now },
      });
      return { user: toUserRecord(user), session: toSessionRecord(session) };
    });
  }
  async findActiveSessionByHash(sessionHash: string, now: Date): Promise<AuthSessionWithUser | null> {
    const result = await this.prisma.session.findFirst({
      where: { sessionHash, revokedAt: null, expiresAt: { gt: now }, user: { is: { deletedAt: null } } },
      include: { user: true },
    });
    return result ? { session: toSessionRecord(result), user: toUserRecord(result.user) } : null;
  }
  async touchSession(sessionId: string, at: Date): Promise<void> {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null, expiresAt: { gt: at } }, data: { lastSeenAt: at } });
  }
  async revokeByHash(sessionHash: string, at: Date): Promise<void> {
    await this.prisma.session.updateMany({ where: { sessionHash, revokedAt: null }, data: { revokedAt: at } });
  }
  async listSessions(userId: string, limit: number): Promise<AuthSessionRecord[]> {
    const sessions = await this.prisma.session.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(limit, 1), 100) });
    return sessions.map(toSessionRecord);
  }
  async revokeSession(userId: string, sessionId: string, at: Date): Promise<boolean> {
    const result = await this.prisma.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: at } });
    return result.count === 1;
  }
}
