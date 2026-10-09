import {
  PERMISSION_KEYS,
  type ActorContext,
  type AuthorizationResult,
  type PermissionKey,
  type PermissionOverride,
  type RolePermissionGrant,
  isPermissionKey,
} from "@vreeo/types";

export interface PermissionDefinition {
  key: PermissionKey;
  domain: string;
  action: string;
}

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = PERMISSION_KEYS.map((key) => {
  const separator = key.indexOf(".");
  return {
    key,
    domain: key.slice(0, separator),
    action: key.slice(separator + 1),
  };
});

export interface DiscordPermissionContext {
  requiredPermissions: readonly string[];
  grantedPermissions: readonly string[];
  /** Set only when the action is a bot-executed member/role operation. */
  botHierarchyAllowed?: boolean;
}

export interface EvaluatePermissionInput {
  authenticated: boolean;
  /** Server-resolved guild context; never copy this from an unvalidated client field. */
  requestedGuildId: string;
  guildAccess: boolean;
  actor: ActorContext;
  permission: string;
  overrides: readonly PermissionOverride[];
  /** Server-loaded permission_roles rows for this guild. */
  roleGrants: readonly RolePermissionGrant[];
  /** The selected conceptual profile's permissions; profile assignments are supplied by policy/configuration. */
  defaultPermissions: readonly PermissionKey[];
  discord?: DiscordPermissionContext;
}

function resolveOverride(
  overrides: readonly PermissionOverride[],
  actor: ActorContext,
  permission: PermissionKey,
): "allow" | "deny" | undefined {
  const userOverrides = overrides.filter((item) =>
    item.permission === permission &&
    item.subjectType === "user" &&
    actor.discordUserId !== undefined &&
    item.subjectId === actor.discordUserId
  );
  if (userOverrides.some((item) => item.effect === "deny")) return "deny";
  if (userOverrides.some((item) => item.effect === "allow")) return "allow";

  const roleIds = new Set(actor.roleIds);
  const roleOverrides = overrides.filter((item) =>
    item.permission === permission &&
    item.subjectType === "role" &&
    roleIds.has(item.subjectId)
  );
  if (roleOverrides.some((item) => item.effect === "deny")) return "deny";
  if (roleOverrides.some((item) => item.effect === "allow")) return "allow";
  return undefined;
}

/**
 * Evaluates authentication/guild-access gates, Discord capability/hierarchy,
 * then VREEO permission. Entitlements and feature flags remain separate gates.
 */
export function evaluatePermission(input: EvaluatePermissionInput): AuthorizationResult {
  if (!input.authenticated) return { allowed: false, reasons: ["UNAUTHENTICATED"] };
  if (!input.guildAccess || input.actor.guildId !== input.requestedGuildId) {
    return { allowed: false, reasons: ["GUILD_ACCESS_DENIED"] };
  }

  if (!isPermissionKey(input.permission)) return { allowed: false, reasons: ["UNKNOWN_PERMISSION"] };
  const permission = input.permission as PermissionKey;

  const reasons: AuthorizationResult["reasons"] = [];
  if (input.discord) {
    if (input.discord.requiredPermissions.some((permission) => !input.discord?.grantedPermissions.includes(permission))) {
      reasons.push("MISSING_DISCORD_PERMISSION");
    }
    if (input.discord.botHierarchyAllowed === false) {
      reasons.push("BOT_HIERARCHY_BLOCKED");
    }
  }
  if (reasons.length > 0) return { allowed: false, reasons };

  const override = resolveOverride(input.overrides, input.actor, permission);
  if (override === "allow") return { allowed: true, reasons: [] };
  if (override === "deny") return { allowed: false, reasons: ["MISSING_VREEO_PERMISSION"] };

  const assignedRoleIds = new Set(input.actor.roleIds);
  const roleEffects = input.roleGrants
    .filter((grant) => grant.guildId === input.requestedGuildId && assignedRoleIds.has(grant.discordRoleId))
    .map((grant) => {
      const value = grant.permissionSet[permission];
      return value === true ? "allow" as const : value === false ? "deny" as const : undefined;
    });
  if (roleEffects.includes("deny")) return { allowed: false, reasons: ["MISSING_VREEO_PERMISSION"] };
  if (roleEffects.includes("allow")) return { allowed: true, reasons: [] };

  const allowed = input.defaultPermissions.includes(permission);

  return allowed
    ? { allowed: true, reasons: [] }
    : { allowed: false, reasons: ["MISSING_VREEO_PERMISSION"] };
}

