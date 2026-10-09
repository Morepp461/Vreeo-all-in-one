import {
  PERMISSION_KEYS,
  type ActorContext,
  type AuthorizationResult,
  type PermissionKey,
  type PermissionOverride,
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
  guildAccess: boolean;
  actor: ActorContext;
  permission: PermissionKey;
  overrides: readonly PermissionOverride[];
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
  if (!input.guildAccess) return { allowed: false, reasons: ["GUILD_ACCESS_DENIED"] };

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

  const override = resolveOverride(input.overrides, input.actor, input.permission);
  const allowed = override === "allow"
    ? true
    : override === "deny"
      ? false
      : input.defaultPermissions.includes(input.permission);

  return allowed
    ? { allowed: true, reasons: [] }
    : { allowed: false, reasons: ["MISSING_VREEO_PERMISSION"] };
}

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}
