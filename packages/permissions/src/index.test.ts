import { describe, expect, it } from "vitest";
import type { ActorContext, PermissionOverride, PermissionKey } from "@vreeo/types";
import { evaluatePermission, isPermissionKey, PERMISSION_DEFINITIONS } from "./index.js";

const actor: ActorContext = {
  actorType: "user",
  userId: "user-internal-1",
  discordUserId: "discord-user-1",
  guildId: "guild-1",
  roleIds: ["role-moderator", "role-community"],
};
const permission: PermissionKey = "moderation.warn";

function evaluate(overrides: readonly PermissionOverride[], defaultPermissions: readonly PermissionKey[] = []) {
  return evaluatePermission({
    authenticated: true,
    guildAccess: true,
    actor,
    permission,
    overrides,
    defaultPermissions,
  });
}

const roleAllow: PermissionOverride = {
  subjectType: "role", subjectId: "role-moderator", permission, effect: "allow",
};
const roleDeny: PermissionOverride = {
  subjectType: "role", subjectId: "role-community", permission, effect: "deny",
};
const userAllow: PermissionOverride = {
  subjectType: "user", subjectId: "discord-user-1", permission, effect: "allow",
};
const userDeny: PermissionOverride = {
  subjectType: "user", subjectId: "discord-user-1", permission, effect: "deny",
};

describe("permission evaluation", () => {
  it("denies before checking permissions when authentication or guild access is absent", () => {
    expect(evaluatePermission({
      authenticated: false, guildAccess: true, actor, permission, overrides: [], defaultPermissions: [permission],
    })).toEqual({ allowed: false, reasons: ["UNAUTHENTICATED"] });
    expect(evaluatePermission({
      authenticated: true, guildAccess: false, actor, permission, overrides: [], defaultPermissions: [permission],
    })).toEqual({ allowed: false, reasons: ["GUILD_ACCESS_DENIED"] });
  });

  it("uses deterministic precedence: user deny, user allow, role deny, role allow, default profile", () => {
    expect(evaluate([userDeny, userAllow, roleAllow], [permission]).allowed).toBe(false);
    expect(evaluate([userAllow, roleDeny], []).allowed).toBe(true);
    expect(evaluate([roleDeny, roleAllow], [permission]).allowed).toBe(false);
    expect(evaluate([roleAllow], []).allowed).toBe(true);
    expect(evaluate([], [permission]).allowed).toBe(true);
    expect(evaluate([], []).reasons).toEqual(["MISSING_VREEO_PERMISSION"]);
  });

  it("requires Discord capabilities and bot hierarchy when supplied", () => {
    expect(evaluatePermission({
      authenticated: true, guildAccess: true, actor, permission, overrides: [], defaultPermissions: [permission],
      discord: { requiredPermissions: ["BanMembers"], grantedPermissions: [] },
    })).toEqual({ allowed: false, reasons: ["MISSING_DISCORD_PERMISSION"] });
    expect(evaluatePermission({
      authenticated: true, guildAccess: true, actor, permission, overrides: [], defaultPermissions: [permission],
      discord: { requiredPermissions: [], grantedPermissions: [], botHierarchyAllowed: false },
    })).toEqual({ allowed: false, reasons: ["BOT_HIERARCHY_BLOCKED"] });
  });

  it("exposes only keys from the specification inventory", () => {
    expect(isPermissionKey("moderation.warn")).toBe(true);
    expect(isPermissionKey("moderation.magic")).toBe(false);
    expect(PERMISSION_DEFINITIONS.find((item) => item.key === "moderation.warn"))
      .toEqual({ key: "moderation.warn", domain: "moderation", action: "warn" });
  });
});
