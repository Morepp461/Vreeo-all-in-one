import { prisma } from '@vreeo/database/client';
import { hashOpaqueToken } from './crypto.js';

const lastSeenUpdateIntervalMs = 5 * 60 * 1000;

export async function createSession(
  userId: string,
  rawToken: string,
  secret: string,
  ttlSeconds: number,
) {
  const now = new Date();

  return prisma.session.create({
    data: {
      userId,
      sessionHash: hashOpaqueToken(rawToken, secret),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
    },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      expiresAt: true,
      lastSeenAt: true,
    },
  });
}

export async function resolveSession(rawToken: string | undefined, secret: string | undefined) {
  if (!rawToken || !secret) return null;

  const now = new Date();
  const sessionHash = hashOpaqueToken(rawToken, secret);
  const session = await prisma.session.findFirst({
    where: {
      sessionHash,
      revokedAt: null,
      expiresAt: { gt: now },
      user: { deletedAt: null },
    },
    select: {
      id: true,
      userId: true,
      sessionHash: true,
      createdAt: true,
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          discordUserId: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          locale: true,
        },
      },
    },
  });

  if (!session) return null;

  if (now.getTime() - session.lastSeenAt.getTime() >= lastSeenUpdateIntervalMs) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
  }

  return session;
}

export async function revokeSession(rawToken: string | undefined, secret: string | undefined) {
  if (!rawToken || !secret) return;

  await prisma.session.updateMany({
    where: {
      sessionHash: hashOpaqueToken(rawToken, secret),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}
