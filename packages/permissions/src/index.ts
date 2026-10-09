import {
  isPermissionKey,
  type PermissionDecision,
  type PermissionEffect,
  type PermissionKey,
  type PermissionOverride,
  type RolePermissionGrant,
} from "@vreeo/types";

export interface EvaluatePermissionInput {
  permission: string;
  actorDiscordUserId: string;
  actorRoleIds: readonly string[];
  roleGrants: readonly RolePermissionGrant[];
  overrides: readonly PermissionOverride[];
  defaultProfileAllows?: boolean;
}

type Effect = PermissionEffect | undefined;

function readRoleEffect(value: unknown): Effect {
  if (value === true) return "allow";
  if (value === false) return "deny";
  return undefined;
}

function decision(allowed: boolean, reason?: string): PermissionDecision {
  return allowed ? { allowed: true, reasons: [] } : { allowed: false, reasons: [reason ?? "MISSING_VREEO_PERMISSION"] };
}

/**
 * Evaluate only the VREEO permission layer. Callers must separately enforce
 * authentication, guild access, Discord permissions, hierarchy, entitlements,
 * feature flags, and action-specific validation.
 *
 * Precedence follows the source specification:
 * explicit user deny > explicit user allow > role deny > role allow > default profile.
 */
export function evaluatePermission(input: EvaluatePermissionInput): PermissionDecision {
  if (!isPermissionKey(input.permission)) return decision(false, "UNKNOWN_PERMISSION");

  const permission = input.permission as PermissionKey;
  const userOverrides = input.overrides.filter(
    (override) =>
      override.subjectType === "user" &&
      override.subjectDiscordId === input.actorDiscordUserId &&
      override.permissionKey === permission,
  );

  if (userOverrides.some((override) => override.effect === "deny")) {
    return decision(false, "EXPLICIT_USER_DENY");
  }
  if (userOverrides.some((override) => override.effect === "allow")) {
    return decision(true);
  }

  const roleIds = new Set(input.actorRoleIds);
  const roleOverrides = input.overrides.filter(
    (override) =>
      override.subjectType === "role" &&
      roleIds.has(override.subjectDiscordId) &&
      override.permissionKey === permission,
  );
  const roleGrantEffects = input.roleGrants
    .filter((grant) => roleIds.has(grant.discordRoleId))
    .map((grant) => readRoleEffect(grant.permissionSet[permission]));
  const roleEffects: Effect[] = [
    ...roleOverrides.map((override) => override.effect),
    ...roleGrantEffects,
  ];

  if (roleEffects.includes("deny")) return decision(false, "ROLE_PERMISSION_DENY");
  if (roleEffects.includes("allow")) return decision(true);

  return input.defaultProfileAllows === true
    ? decision(true)
    : decision(false, "MISSING_VREEO_PERMISSION");
}

export function hasPermission(input: EvaluatePermissionInput): boolean {
  return evaluatePermission(input).allowed;
}
