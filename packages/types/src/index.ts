/**
 * Stable domain identifiers shared across the API, bot, dashboard contracts,
 * and domain services. Plan-to-feature assignments remain data-driven and are
 * intentionally not encoded here.
 */
export const PERMISSION_KEYS = [
  "guild.view", "guild.manage", "guild.settings",
  "members.view", "members.manage", "members.nickname", "members.roles", "members.bulk",
  "roles.view", "roles.manage", "roles.permissions",
  "channels.view", "channels.manage",
  "moderation.view", "moderation.warn", "moderation.timeout", "moderation.kick", "moderation.ban",
  "moderation.unban", "moderation.purge", "moderation.lock", "moderation.unlock", "moderation.manage_cases",
  "appeals.view", "appeals.review", "appeals.manage",
  "automod.view", "automod.manage", "automod.test",
  "security.view", "security.manage", "security.trusted_entities", "security.lockdown", "security.recovery",
  "verification.view", "verification.manage", "verification.review",
  "logging.view", "logging.manage",
  "leveling.view", "leveling.manage", "leveling.adjust",
  "economy.view", "economy.manage", "economy.adjust", "economy.items",
  "tickets.view", "tickets.manage", "tickets.claim", "tickets.close", "tickets.notes", "tickets.transcripts",
  "forms.view", "forms.manage", "forms.review",
  "role_menus.view", "role_menus.manage", "role_menus.publish",
  "giveaways.view", "giveaways.manage",
  "suggestions.view", "suggestions.manage", "suggestions.review",
  "polls.view", "polls.manage",
  "events.view", "events.manage",
  "achievements.view", "achievements.manage",
  "rewards.view", "rewards.manage",
  "announcements.view", "announcements.manage", "announcements.send",
  "notifications.view", "notifications.manage",
  "wiki.view", "wiki.manage",
  "partnerships.view", "partnerships.manage",
  "custom_commands.view", "custom_commands.manage",
  "automation.view", "automation.manage", "automation.execute",
  "workflows.view", "workflows.manage", "workflows.publish", "workflows.execute",
  "integrations.view", "integrations.manage",
  "webhooks.view", "webhooks.manage", "webhooks.rotate_secret",
  "analytics.view", "analytics.export", "analytics.advanced",
  "backups.view", "backups.create", "backups.restore", "backups.delete",
  "templates.view", "templates.manage", "templates.apply",
  "audit_log.view",
  "billing.view", "billing.manage",
  "developer.view", "developer.manage", "developer.api_keys", "developer.oauth_apps",
  "settings.view", "settings.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const INTERNAL_ADMIN_PERMISSION_KEYS = [
  "admin.users.read",
  "admin.guilds.read",
  "admin.billing.read",
  "admin.entitlements.manage",
  "admin.feature_flags.manage",
  "admin.abuse.manage",
  "admin.system.manage",
] as const;
export type InternalAdminPermissionKey = (typeof INTERNAL_ADMIN_PERMISSION_KEYS)[number];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

export function isInternalAdminPermissionKey(value: string): value is InternalAdminPermissionKey {
  return (INTERNAL_ADMIN_PERMISSION_KEYS as readonly string[]).includes(value);
}

export const FEATURE_KEYS = [
  "basic_moderation", "advanced_moderation", "basic_automod", "advanced_automod",
  "security", "advanced_security", "tickets", "advanced_tickets", "forms", "advanced_forms",
  "leveling", "economy", "advanced_economy", "giveaways", "advanced_giveaways",
  "suggestions", "polls", "events", "achievements", "rewards", "announcements",
  "notifications", "wiki", "partnerships", "custom_commands", "advanced_automation",
  "workflows", "integrations", "advanced_integrations", "analytics", "advanced_analytics",
  "exports", "backups", "scheduled_backups", "templates", "developer_api",
  "advanced_developer_api", "custom_branding",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const PLAN_KEYS = ["free", "premium", "premium_plus"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export const ENTITLEMENT_SOURCES = [
  "plan", "subscription", "manual_grant", "promotion", "trial", "internal_override",
] as const;
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

export const SUBSCRIPTION_STATES = [
  "active", "trialing", "past_due", "grace", "cancelled", "expired",
] as const;
export type SubscriptionState = (typeof SUBSCRIPTION_STATES)[number];

export type PermissionEffect = "allow" | "deny";
export type PermissionSubjectType = "user" | "role";
export type ActorType = "user" | "system_worker" | "internal_admin";

export interface ActorContext {
  actorType: ActorType;
  userId?: string;
  discordUserId?: string;
  guildId: string;
  roleIds: readonly string[];
}

export interface PermissionOverride {
  subjectType: PermissionSubjectType;
  subjectId: string;
  permission: PermissionKey;
  effect: PermissionEffect;
}

export interface RolePermissionGrant {
  guildId: string;
  discordRoleId: string;
  permissionSet: Readonly<Record<string, unknown>>;
}

export type AuthorizationReason =
  | "UNAUTHENTICATED"
  | "GUILD_ACCESS_DENIED"
  | "MISSING_DISCORD_PERMISSION"
  | "BOT_HIERARCHY_BLOCKED"
  | "MISSING_VREEO_PERMISSION"
  | "UNKNOWN_PERMISSION"
  | "FEATURE_DISABLED"
  | "FEATURE_NOT_ENTITLED"
  | "LIMIT_EXCEEDED"
  | "INVALID_ACTION";

export interface AuthorizationResult {
  allowed: boolean;
  reasons: AuthorizationReason[];
}

export const API_ERROR_CODES = [
  "AUTH_REQUIRED", "AUTH_INVALID", "SESSION_EXPIRED", "OAUTH_STATE_INVALID",
  "GUILD_NOT_FOUND", "GUILD_ACCESS_DENIED", "GUILD_NOT_CONFIGURED",
  "PERMISSION_DENIED", "DISCORD_PERMISSION_REQUIRED", "VREEO_PERMISSION_DENIED",
  "FEATURE_DISABLED", "FEATURE_NOT_ENTITLED", "FEATURE_LIMIT_REACHED",
  "VALIDATION_ERROR", "RESOURCE_NOT_FOUND", "RESOURCE_CONFLICT",
  "DISCORD_API_ERROR", "DISCORD_RATE_LIMITED",
  "JOB_QUEUED", "JOB_FAILED", "IDEMPOTENCY_CONFLICT",
  "INTERNAL_ERROR", "SERVICE_UNAVAILABLE",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

export interface DomainEvent<TMetadata extends Record<string, unknown> = Record<string, unknown>> {
  eventId: string;
  event: string;
  timestamp: string;
  /** Internal UUID when the corresponding guild record is available. */
  guildId?: string;
  /** Internal UUID when the corresponding user record is available. */
  userId?: string;
  discordGuildId?: string;
  discordUserId?: string;
  metadata: TMetadata;
}
