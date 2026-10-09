import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "@vreeo/database";
import type { VreeoGuildContext } from "./context.js";
import { authorizeGuildAction, loadGuildPermissionPolicy } from "./permission-policy.js";

const context: VreeoGuildContext = {
  userId: "internal-user",
  discordUserId: "123456789012345678",
  guildId: "internal-guild",
  discordGuildId: "222222222222222222",
  name: "Example",
  iconUrl: "",
  isOwner: false,
  roleIds: ["role-moderator"],
};

function databaseWith(roleRows: unknown[] = [], overrideRows: unknown[] = []) {
  const database = {
    permissionRole: { findMany: vi.fn(async () => roleRows) },
    permissionOverride: { findMany: vi.fn(async () => overrideRows) },
  } as unknown as DatabaseClient;
  return { database, roleFind: database.permissionRole.findMany as unknown as ReturnType<typeof vi.fn>, overrideFind: database.permissionOverride.findMany as unknown as ReturnType<typeof vi.fn> };
}

describe("database-backed guild permission policy", () => {
  it("loads only role grants for the current guild and the actor's assigned roles", async () => {
    const { database, roleFind, overrideFind } = databaseWith([
      { discordRoleId: "role-moderator", permissionSet: { "moderation.warn": true } },
    ]);
    const policy = await loadGuildPermissionPolicy(database, context, "moderation.warn");
    expect(roleFind).toHaveBeenCalledWith({
      where: { guildId: context.guildId, discordRoleId: { in: ["role-moderator"] } },
      select: { discordRoleId: true, permissionSet: true },
    });
    expect(overrideFind).toHaveBeenCalledWith({
      where: { guildId: context.guildId, permissionKey: "moderation.warn" },
      select: { subjectType: true, subjectDiscordId: true, permissionKey: true, effect: true },
    });
    expect(policy.roleGrants).toEqual([{
      guildId: context.guildId, discordRoleId: "role-moderator", permissionSet: { "moderation.warn": true },
    }]);
    expect(policy.defaultPermissions).toEqual([]);
  });

  it("authorizes a configured role grant and denies unknown permission identifiers", async () => {
    const { database, roleFind } = databaseWith([
      { discordRoleId: "role-moderator", permissionSet: { "moderation.warn": true } },
    ]);
    expect(await authorizeGuildAction(database, context, "moderation.warn")).toEqual({ allowed: true, reasons: [] });
    expect(await authorizeGuildAction(database, context, "not-a-permission")).toEqual({
      allowed: false, reasons: ["UNKNOWN_PERMISSION"],
    });
    expect(roleFind).toHaveBeenCalledTimes(1);
  });

  it("gives explicit user deny precedence over an assigned role grant", async () => {
    const { database } = databaseWith(
      [{ discordRoleId: "role-moderator", permissionSet: { "moderation.warn": true } }],
      [{ subjectType: "user", subjectDiscordId: context.discordUserId, permissionKey: "moderation.warn", effect: "deny" }],
    );
    expect(await authorizeGuildAction(database, context, "moderation.warn")).toEqual({
      allowed: false, reasons: ["MISSING_VREEO_PERMISSION"],
    });
  });

  it("ignores malformed role JSON and malformed override rows", async () => {
    const { database } = databaseWith(
      [{ discordRoleId: "role-moderator", permissionSet: ["not", "an", "object"] }],
      [
        { subjectType: "user", subjectDiscordId: context.discordUserId, permissionKey: "unknown.key", effect: "allow" },
        { subjectType: "global", subjectDiscordId: context.discordUserId, permissionKey: "moderation.warn", effect: "allow" },
        { subjectType: "user", subjectDiscordId: context.discordUserId, permissionKey: "moderation.warn", effect: "maybe" },
      ],
    );
    expect(await authorizeGuildAction(database, context, "moderation.warn")).toEqual({
      allowed: false, reasons: ["MISSING_VREEO_PERMISSION"],
    });
  });

  it("fails closed when the Discord permission context is missing a required permission", async () => {
    const { database } = databaseWith([{ discordRoleId: "role-moderator", permissionSet: { "moderation.warn": true } }]);
    expect(await authorizeGuildAction(database, context, "moderation.warn", {
      requiredPermissions: ["ManageMessages"],
      grantedPermissions: [],
    })).toEqual({ allowed: false, reasons: ["MISSING_DISCORD_PERMISSION"] });
  });
});
