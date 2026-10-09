export const PERMISSION_KEYS = [
  "achievements.manage",
  "achievements.view",
  "analytics.advanced",
  "analytics.export",
  "analytics.view",
  "announcements.manage",
  "announcements.send",
  "announcements.view",
  "appeals.manage",
  "appeals.review",
  "appeals.view",
  "audit_log.view",
  "automation.execute",
  "automation.manage",
  "automation.view",
  "automod.manage",
  "automod.test",
  "automod.view",
  "backups.create",
  "backups.delete",
  "backups.restore",
  "backups.view",
  "billing.manage",
  "billing.view",
  "channels.manage",
  "channels.view",
  "custom_commands.manage",
  "custom_commands.view",
  "developer.api_keys",
  "developer.manage",
  "developer.oauth_apps",
  "developer.view",
  "economy.adjust",
  "economy.items",
  "economy.manage",
  "economy.view",
  "events.manage",
  "events.view",
  "forms.manage",
  "forms.review",
  "forms.view",
  "giveaways.manage",
  "giveaways.view",
  "guild.manage",
  "guild.settings",
  "guild.view",
  "integrations.manage",
  "integrations.view",
  "leveling.adjust",
  "leveling.manage",
  "leveling.view",
  "logging.manage",
  "logging.view",
  "members.bulk",
  "members.manage",
  "members.nickname",
  "members.roles",
  "members.view",
  "moderation.ban",
  "moderation.kick",
  "moderation.lock",
  "moderation.manage_cases",
  "moderation.purge",
  "moderation.timeout",
  "moderation.unban",
  "moderation.unlock",
  "moderation.view",
  "moderation.warn",
  "notifications.manage",
  "notifications.view",
  "partnerships.manage",
  "partnerships.view",
  "polls.manage",
  "polls.view",
  "rewards.manage",
  "rewards.view",
  "role_menus.manage",
  "role_menus.publish",
  "role_menus.view",
  "roles.manage",
  "roles.permissions",
  "roles.view",
  "security.lockdown",
  "security.manage",
  "security.recovery",
  "security.trusted_entities",
  "security.view",
  "settings.manage",
  "settings.view",
  "suggestions.manage",
  "suggestions.review",
  "suggestions.view",
  "templates.apply",
  "templates.manage",
  "templates.view",
  "tickets.claim",
  "tickets.close",
  "tickets.manage",
  "tickets.notes",
  "tickets.transcripts",
  "tickets.view",
  "verification.manage",
  "verification.review",
  "verification.view",
  "webhooks.manage",
  "webhooks.rotate_secret",
  "webhooks.view",
  "wiki.manage",
  "wiki.view",
  "workflows.execute",
  "workflows.manage",
  "workflows.publish",
  "workflows.view"
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const INTERNAL_ADMIN_PERMISSION_KEYS = [
  "admin.users.read",
  "admin.guilds.read",
  "admin.billing.read",
  "admin.entitlements.manage",
  "admin.feature_flags.manage",
  "admin.abuse.manage",
  "admin.system.manage"
] as const;
export type InternalAdminPermissionKey = (typeof INTERNAL_ADMIN_PERMISSION_KEYS)[number];

export const FEATURE_KEYS = [
  "basic_moderation",
  "advanced_moderation",
  "basic_automod",
  "advanced_automod",
  "security",
  "advanced_security",
  "tickets",
  "advanced_tickets",
  "forms",
  "advanced_forms",
  "leveling",
  "economy",
  "advanced_economy",
  "giveaways",
  "advanced_giveaways",
  "suggestions",
  "polls",
  "events",
  "achievements",
  "rewards",
  "announcements",
  "notifications",
  "wiki",
  "partnerships",
  "custom_commands",
  "advanced_automation",
  "workflows",
  "integrations",
  "advanced_integrations",
  "analytics",
  "advanced_analytics",
  "exports",
  "backups",
  "scheduled_backups",
  "templates",
  "developer_api",
  "advanced_developer_api",
  "custom_branding"
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

const permissionKeySet: ReadonlySet<string> = new Set(PERMISSION_KEYS);
const internalAdminPermissionKeySet: ReadonlySet<string> = new Set(INTERNAL_ADMIN_PERMISSION_KEYS);
const featureKeySet: ReadonlySet<string> = new Set(FEATURE_KEYS);

export function isPermissionKey(value: string): value is PermissionKey {
  return permissionKeySet.has(value);
}

export function isInternalAdminPermissionKey(value: string): value is InternalAdminPermissionKey {
  return internalAdminPermissionKeySet.has(value);
}

export function isFeatureKey(value: string): value is FeatureKey {
  return featureKeySet.has(value);
}

export type PermissionEffect = "allow" | "deny";
export type PermissionSubjectType = "user" | "role";
export type EntitlementSourceType = "plan" | "subscription" | "manual_grant" | "promotion" | "trial" | "internal_override";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "grace" | "cancelled" | "expired";

export interface PermissionOverride {
  subjectType: PermissionSubjectType;
  subjectDiscordId: string;
  permissionKey: PermissionKey;
  effect: PermissionEffect;
}

export interface RolePermissionGrant {
  discordRoleId: string;
  permissionSet: Readonly<Record<string, unknown>>;
}

export interface PermissionDecision {
  allowed: boolean;
  reasons: readonly string[];
}

export interface EntitlementResolution {
  enabled: boolean;
  limit: number | null;
  source: EntitlementSourceType;
  expiresAt: Date | null;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "ENTITLEMENT_REQUIRED"
  | "DISCORD_ERROR"
  | "INTERNAL_ERROR";

export type ModerationAction = "warn" | "timeout" | "kick" | "ban" | "unban" | "purge" | "lock" | "unlock";

export interface CreateModerationCaseRequest {
  targetUserId: string;
  action: ModerationAction;
  reason: string;
  durationSeconds: number | null;
}

export interface ModerationCaseAccepted {
  caseId: string;
  status: "queued";
}

export interface DomainEvent<TType extends string, TPayload> {
  id: string;
  type: TType;
  occurredAt: Date;
  correlationId?: string;
  guildId?: string;
  actorDiscordUserId?: string;
  payload: TPayload;
}

export interface CommandMetadata {
  name: string;
  description: string;
  permission?: PermissionKey;
  entitlement?: FeatureKey;
  guildOnly: boolean;
}
