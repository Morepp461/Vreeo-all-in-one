import { describe, expect, it } from "vitest";
import { evaluatePermission, hasPermission } from "./index.js";

const base = {
  permission: "moderation.warn",
  actorDiscordUserId: "user-1",
  actorRoleIds: ["role-1", "role-2"],
  roleGrants: [],
  overrides: [],
};

describe("central permission evaluation", () => {
  it("denies unknown permission keys even if a caller attempts to allow them", () => {
    expect(evaluatePermission({
      ...base,
      permission: "moderation.unknown",
      overrides: [{
        subjectType: "user",
        subjectDiscordId: "user-1",
        permissionKey: "moderation.unknown" as never,
        effect: "allow",
      }],
    })).toEqual({ allowed: false, reasons: ["UNKNOWN_PERMISSION"] });
  });

  it("uses explicit user deny before explicit user allow", () => {
    expect(evaluatePermission({
      ...base,
      overrides: [
        { subjectType: "user", subjectDiscordId: "user-1", permissionKey: "moderation.warn", effect: "allow" },
        { subjectType: "user", subjectDiscordId: "user-1", permissionKey: "moderation.warn", effect: "deny" },
      ],
    })).toEqual({ allowed: false, reasons: ["EXPLICIT_USER_DENY"] });
  });

  it("uses explicit user allow before role-level denies", () => {
    expect(evaluatePermission({
      ...base,
      overrides: [
        { subjectType: "user", subjectDiscordId: "user-1", permissionKey: "moderation.warn", effect: "allow" },
        { subjectType: "role", subjectDiscordId: "role-1", permissionKey: "moderation.warn", effect: "deny" },
      ],
    })).toEqual({ allowed: true, reasons: [] });
  });

  it("denies when any assigned role explicitly denies the permission", () => {
    expect(evaluatePermission({
      ...base,
      roleGrants: [
        { discordRoleId: "role-1", permissionSet: { "moderation.warn": true } },
        { discordRoleId: "role-2", permissionSet: { "moderation.warn": false } },
      ],
    })).toEqual({ allowed: false, reasons: ["ROLE_PERMISSION_DENY"] });
  });

  it("allows a role grant when no role denies it", () => {
    expect(hasPermission({
      ...base,
      roleGrants: [{ discordRoleId: "role-1", permissionSet: { "moderation.warn": true } }],
    })).toBe(true);
  });

  it("falls back to a default profile only when no user or role decision exists", () => {
    expect(evaluatePermission({ ...base, defaultProfileAllows: true })).toEqual({ allowed: true, reasons: [] });
    expect(evaluatePermission(base)).toEqual({ allowed: false, reasons: ["MISSING_VREEO_PERMISSION"] });
  });
});
