import { randomUUID } from "node:crypto";
import { createDatabaseClient } from "@vreeo/database";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createWarning, IdempotencyConflictError, WarningValidationError, type CreateWarningInput } from "./warnings.js";

const database = createDatabaseClient({
  url: process.env.DATABASE_URL ?? "postgresql://vreeo:vreeo_dev_only@127.0.0.1:5432/vreeo?schema=public",
});
let guildId: string | undefined;
let discordGuildId: string;
let sequence = 0;

beforeAll(async () => { await database.$connect(); });
afterAll(async () => { await database.$disconnect(); });

beforeEach(async () => {
  discordGuildId = (BigInt(Date.now()) * 1_000_000n + BigInt(++sequence)).toString();
  const guild = await database.guild.create({
    data: {
      discordGuildId,
      name: "Warning Service Test",
      iconUrl: "",
      ownerDiscordUserId: "111111111111111111",
      active: true,
      botJoinedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });
  guildId = guild.id;
});

afterEach(async () => {
  if (!guildId) return;
  await database.auditLog.deleteMany({ where: { guildId } });
  await database.warning.deleteMany({ where: { guildId } });
  await database.moderationCase.deleteMany({ where: { guildId } });
  await database.idempotencyKey.deleteMany({ where: { scope: "guild:" + guildId + ":moderation.warn" } });
  await database.guild.delete({ where: { id: guildId } });
  guildId = undefined;
});

function input(overrides: Partial<CreateWarningInput> = {}): CreateWarningInput {
  if (!guildId) throw new Error("Test guild was not created");
  return {
    guildId,
    targetDiscordUserId: "222222222222222222",
    moderatorDiscordUserId: "333333333333333333",
    reason: "Repeated spam",
    idempotencyKey: randomUUID(),
    idempotencyExpiresAt: new Date(Date.now() + 3_600_000),
    source: "api",
    ...overrides,
  };
}

describe("Moderation Warn domain service", () => {
  it("creates a warning, active case, and audit record atomically", async () => {
    const result = await createWarning(database, input({ correlationId: "request-123" }));
    expect(result).toMatchObject({ status: 201, replayed: false, body: { caseNumber: 1, status: "active", reason: "Repeated spam" } });
    const [moderationCase, warning, audit] = await Promise.all([
      database.moderationCase.findUnique({ where: { id: result.body.caseId } }),
      database.warning.findUnique({ where: { id: result.body.warningId } }),
      database.auditLog.findFirst({ where: { resourceId: result.body.caseId, action: "moderation.warn.created" } }),
    ]);
    expect(moderationCase).toMatchObject({ action: "warn", status: "active", caseNumber: 1n, guildId });
    expect(warning).toMatchObject({ targetDiscordUserId: "222222222222222222", moderatorDiscordUserId: "333333333333333333", caseId: result.body.caseId });
    expect(audit).toMatchObject({ source: "api", correlationId: "request-123", actorDiscordUserId: "333333333333333333" });
  });

  it("replays an identical idempotent request and rejects key reuse with a different body", async () => {
    const request = input({ idempotencyKey: "warn-request-1" });
    const first = await createWarning(database, request);
    const replay = await createWarning(database, request);
    expect(replay.replayed).toBe(true);
    expect(replay.body).toEqual(first.body);
    await expect(createWarning(database, { ...request, reason: "Different reason" })).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(await database.warning.count({ where: { guildId } })).toBe(1);
    expect(await database.moderationCase.count({ where: { guildId } })).toBe(1);
  });

  it("serializes concurrent retries and allocates unique case numbers per guild", async () => {
    const sameKey = input({ idempotencyKey: "concurrent-key" });
    const duplicates = await Promise.all([createWarning(database, sameKey), createWarning(database, sameKey)]);
    expect(duplicates.map((item) => item.body.caseId).every((id) => id === duplicates[0]?.body.caseId)).toBe(true);
    expect(duplicates.filter((item) => item.replayed)).toHaveLength(1);

    const [first, second] = await Promise.all([
      createWarning(database, input({ idempotencyKey: "unique-key-a", targetDiscordUserId: "444444444444444444" })),
      createWarning(database, input({ idempotencyKey: "unique-key-b", targetDiscordUserId: "555555555555555555" })),
    ]);
    expect([first.body.caseNumber, second.body.caseNumber].sort()).toEqual([2, 3]);
    expect(await database.moderationCase.count({ where: { guildId } })).toBe(3);
  });

  it("rejects inactive guilds and a moderator identity that does not match the authenticated user", async () => {
    await database.guild.update({ where: { id: guildId }, data: { active: false, botJoinedAt: null } });
    await expect(createWarning(database, input())).rejects.toBeInstanceOf(WarningValidationError);
    await database.guild.update({ where: { id: guildId }, data: { active: true, botJoinedAt: new Date() } });
    await expect(createWarning(database, input({ actorUserId: randomUUID() }))).rejects.toBeInstanceOf(WarningValidationError);
    expect(await database.moderationCase.count({ where: { guildId } })).toBe(0);
  });

  it("rejects invalid IDs, empty reasons, and non-future expiry before writing", async () => {
    await expect(createWarning(database, input({ targetDiscordUserId: "not-a-snowflake" }))).rejects.toBeInstanceOf(WarningValidationError);
    await expect(createWarning(database, input({ reason: "   " }))).rejects.toBeInstanceOf(WarningValidationError);
    await expect(createWarning(database, input({ idempotencyExpiresAt: new Date(Date.now() - 1) }))).rejects.toBeInstanceOf(WarningValidationError);
    expect(await database.moderationCase.count({ where: { guildId } })).toBe(0);
  });
});
