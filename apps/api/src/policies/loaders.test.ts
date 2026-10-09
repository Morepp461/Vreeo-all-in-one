import type { PrismaClient } from "@vreeo/database";
import { resolveEntitlement } from "@vreeo/entitlements";
import { describe, expect, it, vi } from "vitest";
import { loadEntitlementCandidates, loadPermissionPolicy } from "./loaders.js";

function fakeDatabase(overrides: Record<string, unknown> = {}): PrismaClient {
  return {
    guild: { findUnique: vi.fn().mockResolvedValue({ id: "guild-internal", active: true, botJoinedAt: new Date("2026-01-01T00:00:00Z") }) },
    permissionRole: { findMany: vi.fn().mockResolvedValue([{ discordRoleId: "role-staff", permissionSet: { "moderation.warn": true } }]) },
    permissionOverride: { findMany: vi.fn().mockResolvedValue([
      { subjectType: "user", subjectDiscordId: "user-1", permissionKey: "moderation.warn", effect: "deny" },
    ]) },
    entitlement: { findMany: vi.fn().mockResolvedValue([
      { sourceType: "subscription", sourceId: "subscription-1", enabled: true, limitValue: 25n, expiresAt: null },
    ]) },
    subscription: { findMany: vi.fn().mockResolvedValue([
      { id: "subscription-1", status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: new Date("2027-01-01T00:00:00Z"), graceUntil: null },
    ]) },
    ...overrides,
  } as unknown as PrismaClient;
}

describe("Prisma policy loaders", () => {
  it("loads permission roles and overrides scoped to the selected guild", async () => {
    const database = fakeDatabase();
    const policy = await loadPermissionPolicy(database, {
      discordGuildId: "123456789012345678",
      permission: "moderation.warn",
      discordUserId: "user-1",
      roleIds: ["role-staff", "role-staff"],
    });
    expect(policy).toEqual({
      guildInternalId: "guild-internal",
      overrides: [{ subjectType: "user", subjectId: "user-1", permission: "moderation.warn", effect: "deny" }],
      roleGrants: [{ guildId: "123456789012345678", discordRoleId: "role-staff", permissionSet: { "moderation.warn": true } }],
    });
  });

  it("fails closed for inactive guilds and malformed stored overrides", async () => {
    const inactive = fakeDatabase({ guild: { findUnique: vi.fn().mockResolvedValue({ id: "guild-internal", active: false, botJoinedAt: null }) } });
    await expect(loadPermissionPolicy(inactive, { discordGuildId: "1", permission: "moderation.warn", roleIds: [] })).resolves.toBeNull();
    const malformed = fakeDatabase({ permissionOverride: { findMany: vi.fn().mockResolvedValue([
      { subjectType: "everyone", subjectDiscordId: "everyone", permissionKey: "moderation.warn", effect: "allow" },
    ]) } });
    await expect(loadPermissionPolicy(malformed, { discordGuildId: "1", permission: "moderation.warn", roleIds: [] }))
      .rejects.toThrow(/invalid policy value/);
  });

  it("maps subscription state and safely typed limits for the pure resolver", async () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const candidates = await loadEntitlementCandidates(fakeDatabase(), {
      discordGuildId: "123456789012345678", featureKey: "basic_moderation", now, graceAccessAllowed: false,
    });
    expect(candidates).toEqual([{
      featureKey: "basic_moderation", source: "subscription", enabled: true, limit: 25, expiresAt: null,
      subscriptionState: "active", cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date("2027-01-01T00:00:00Z"), graceAccessAllowed: false,
    }]);
    expect(resolveEntitlement("basic_moderation", candidates, { precedence: ["subscription"], now }))
      .toMatchObject({ enabled: true, limit: 25, source: "subscription" });
  });

  it("does not grant missing or unknown subscription states and rejects unknown sources", async () => {
    const missingSubscription = fakeDatabase({ subscription: { findMany: vi.fn().mockResolvedValue([]) } });
    const candidates = await loadEntitlementCandidates(missingSubscription, {
      discordGuildId: "123456789012345678", featureKey: "basic_moderation", now: new Date("2026-10-01T00:00:00Z"), graceAccessAllowed: true,
    });
    expect(resolveEntitlement("basic_moderation", candidates, { precedence: ["subscription"] }))
      .toMatchObject({ enabled: false, source: null });
    const unknownSource = fakeDatabase({ entitlement: { findMany: vi.fn().mockResolvedValue([
      { sourceType: "mystery", sourceId: null, enabled: true, limitValue: null, expiresAt: null },
    ]) } });
    await expect(loadEntitlementCandidates(unknownSource, {
      discordGuildId: "123456789012345678", featureKey: "basic_moderation", now: new Date(), graceAccessAllowed: false,
    })).rejects.toThrow(/unknown source/);
  });
});
