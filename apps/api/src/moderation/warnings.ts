import { createHash } from "node:crypto";
import type { PrismaClient } from "@vreeo/database";

export type WarningSource = "api" | "bot" | "automod" | "system_worker";
export interface CreateWarningInput {
  /** Internal UUID from the validated tenant context, never a raw client guild ID. */
  guildId: string;
  targetDiscordUserId: string;
  moderatorDiscordUserId: string;
  actorUserId?: string;
  reason: string;
  expiresAt?: Date | null;
  idempotencyKey: string;
  /** Caller chooses retention according to the idempotency policy; no implicit TTL is invented here. */
  idempotencyExpiresAt: Date;
  source: WarningSource;
  correlationId?: string;
}
export interface WarningResponse {
  caseId: string;
  caseNumber: number;
  warningId: string;
  targetUserId: string;
  moderatorUserId: string;
  reason: string;
  status: "active";
  createdAt: string;
}
export interface CreateWarningResult {
  status: 201;
  body: WarningResponse;
  replayed: boolean;
}

export class WarningValidationError extends Error {
  constructor(message: string) { super(message); this.name = "WarningValidationError"; }
}
export class IdempotencyConflictError extends Error {
  constructor() { super("The idempotency key was already used with a different request."); this.name = "IdempotencyConflictError"; }
}
export class IdempotencyInProgressError extends Error {
  constructor() { super("The idempotent request has no completed response."); this.name = "IdempotencyInProgressError"; }
}

function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validateInput(input: CreateWarningInput, now: Date): { reason: string; idempotencyKey: string; expiresAt: Date | null } {
  if (!/^\d{1,32}$/.test(input.targetDiscordUserId)) throw new WarningValidationError("Target Discord user ID is invalid.");
  if (!/^\d{1,32}$/.test(input.moderatorDiscordUserId)) throw new WarningValidationError("Moderator Discord user ID is invalid.");
  const reason = input.reason.trim();
  if (reason.length === 0) throw new WarningValidationError("A warning reason is required.");
  const idempotencyKey = input.idempotencyKey.trim();
  if (idempotencyKey.length === 0 || idempotencyKey.length > 255) throw new WarningValidationError("Idempotency-Key must contain between 1 and 255 characters.");
  if (input.idempotencyExpiresAt.getTime() <= now.getTime()) throw new WarningValidationError("Idempotency retention expiry must be in the future.");
  const expiresAt = input.expiresAt ?? null;
  if (expiresAt && expiresAt.getTime() <= now.getTime()) throw new WarningValidationError("Warning expiry must be in the future.");
  return { reason, idempotencyKey, expiresAt };
}

/**
 * Domain persistence service. Call only after actor, guild, VREEO permission,
 * Discord permission, and entitlement gates have succeeded.
 */
export async function createWarning(database: PrismaClient, input: CreateWarningInput, now = new Date()): Promise<CreateWarningResult> {
  const validated = validateInput(input, now);
  const scope = "guild:" + input.guildId + ":moderation.warn";
  const keyHash = sha256(validated.idempotencyKey);
  const requestHash = sha256(JSON.stringify({
    guildId: input.guildId,
    targetDiscordUserId: input.targetDiscordUserId,
    moderatorDiscordUserId: input.moderatorDiscordUserId,
    actorUserId: input.actorUserId ?? null,
    reason: validated.reason,
    expiresAt: validated.expiresAt?.toISOString() ?? null,
    source: input.source,
  }));

  return database.$transaction(async (tx) => {
    // Transaction-scoped advisory lock serializes case-number allocation per guild.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.guildId}))`;

    const prior = await tx.idempotencyKey.findUnique({ where: { scope_keyHash: { scope, keyHash } } });
    if (prior && prior.expiresAt > now) {
      if (prior.requestHash !== requestHash) throw new IdempotencyConflictError();
      if (prior.responseStatus !== 201 || !isRecord(prior.responseBody)) throw new IdempotencyInProgressError();
      return { status: 201, body: prior.responseBody as unknown as WarningResponse, replayed: true };
    }
    if (prior) await tx.idempotencyKey.delete({ where: { id: prior.id } });

    await tx.idempotencyKey.create({
      data: { scope, keyHash, requestHash, expiresAt: input.idempotencyExpiresAt },
    });

    const latest = await tx.moderationCase.aggregate({ where: { guildId: input.guildId }, _max: { caseNumber: true } });
    const caseNumber = (latest._max.caseNumber ?? 0n) + 1n;
    const numericCaseNumber = Number(caseNumber);
    if (!Number.isSafeInteger(numericCaseNumber)) throw new Error("Moderation case number exceeded the safe API integer range.");

    const moderationCase = await tx.moderationCase.create({
      data: {
        guildId: input.guildId,
        caseNumber,
        targetDiscordUserId: input.targetDiscordUserId,
        moderatorDiscordUserId: input.moderatorDiscordUserId,
        action: "warn",
        reason: validated.reason,
        evidence: {},
        durationSeconds: null,
        status: "active",
        expiresAt: null,
      },
    });
    const warning = await tx.warning.create({
      data: {
        guildId: input.guildId,
        targetDiscordUserId: input.targetDiscordUserId,
        moderatorDiscordUserId: input.moderatorDiscordUserId,
        reason: validated.reason,
        caseId: moderationCase.id,
        expiresAt: validated.expiresAt,
      },
    });
    await tx.auditLog.create({
      data: {
        guildId: input.guildId,
        ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
        actorDiscordUserId: input.moderatorDiscordUserId,
        action: "moderation.warn.created",
        resourceType: "moderation_case",
        resourceId: moderationCase.id,
        newValue: {
          caseNumber: caseNumber.toString(),
          targetDiscordUserId: input.targetDiscordUserId,
          warningId: warning.id,
          reason: validated.reason,
        },
        source: input.source,
        ...(input.correlationId ? { correlationId: input.correlationId.slice(0, 100) } : {}),
      },
    });

    const body: WarningResponse = {
      caseId: moderationCase.id,
      caseNumber: numericCaseNumber,
      warningId: warning.id,
      targetUserId: input.targetDiscordUserId,
      moderatorUserId: input.moderatorDiscordUserId,
      reason: validated.reason,
      status: "active",
      createdAt: moderationCase.createdAt.toISOString(),
    };
    await tx.idempotencyKey.update({
      where: { scope_keyHash: { scope, keyHash } },
      data: { responseStatus: 201, responseBody: body },
    });
    return { status: 201, body, replayed: false };
  });
}
