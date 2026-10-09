-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "discord_user_id" VARCHAR(32) NOT NULL,
    "username" VARCHAR(100),
    "display_name" VARCHAR(100),
    "avatar_url" TEXT,
    "locale" VARCHAR(10),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_login_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_account_id" VARCHAR(128) NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guilds" (
    "id" UUID NOT NULL,
    "discord_guild_id" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "icon_url" TEXT,
    "owner_discord_user_id" VARCHAR(32),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "bot_joined_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_settings" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en-US',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "prefix" VARCHAR(20),
    "default_log_channel_id" VARCHAR(32),
    "default_staff_role_id" VARCHAR(32),
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guild_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_features" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "feature_key" VARCHAR(100) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guild_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_members" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "user_id" UUID,
    "discord_user_id" VARCHAR(32) NOT NULL,
    "nickname" VARCHAR(100),
    "joined_at" TIMESTAMPTZ(6),
    "left_at" TIMESTAMPTZ(6),
    "is_member" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guild_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_member_roles" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "discord_role_id" VARCHAR(32) NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMPTZ(6),

    CONSTRAINT "guild_member_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_roles" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "discord_role_id" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "managed" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT NOT NULL DEFAULT '0',
    "color" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guild_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_channels" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "discord_channel_id" VARCHAR(32) NOT NULL,
    "parent_discord_channel_id" VARCHAR(32),
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guild_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_roles" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "discord_role_id" VARCHAR(32) NOT NULL,
    "permission_set" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permission_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_overrides" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "subject_type" VARCHAR(30) NOT NULL,
    "subject_discord_id" VARCHAR(32) NOT NULL,
    "permission_key" VARCHAR(150) NOT NULL,
    "effect" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_cases" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "case_number" BIGINT NOT NULL,
    "target_discord_user_id" VARCHAR(32) NOT NULL,
    "moderator_discord_user_id" VARCHAR(32) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "duration_seconds" BIGINT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "related_case_id" UUID,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warnings" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "target_discord_user_id" VARCHAR(32) NOT NULL,
    "moderator_discord_user_id" VARCHAR(32) NOT NULL,
    "reason" TEXT NOT NULL,
    "case_id" UUID,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeals" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "appellant_discord_user_id" VARCHAR(32) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "decision" TEXT,
    "reviewer_discord_user_id" VARCHAR(32),
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "guild_id" UUID,
    "actor_user_id" UUID,
    "actor_discord_user_id" VARCHAR(32),
    "action" VARCHAR(150) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" VARCHAR(100),
    "old_value" JSONB,
    "new_value" JSONB,
    "source" VARCHAR(50) NOT NULL,
    "correlation_id" VARCHAR(100),
    "ip_hash" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "severity" VARCHAR(20) NOT NULL,
    "actor_discord_user_id" VARCHAR(32),
    "target_discord_id" VARCHAR(32),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by_discord_user_id" VARCHAR(32),
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_entities" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "entity_type" VARCHAR(30) NOT NULL,
    "discord_id" VARCHAR(32) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "trusted_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lockdowns" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "scope_type" VARCHAR(30) NOT NULL,
    "scope_id" VARCHAR(32),
    "reason" TEXT NOT NULL,
    "trigger_type" VARCHAR(30) NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "started_by_discord_user_id" VARCHAR(32),
    "ended_by_discord_user_id" VARCHAR(32),

    CONSTRAINT "lockdowns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_discord_user_id_key" ON "users"("discord_user_id");

-- CreateIndex
CREATE INDEX "users_last_login_at_idx" ON "users"("last_login_at");

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key" ON "oauth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "guilds_discord_guild_id_key" ON "guilds"("discord_guild_id");

-- CreateIndex
CREATE INDEX "guilds_active_idx" ON "guilds"("active");

-- CreateIndex
CREATE INDEX "guilds_owner_discord_user_id_idx" ON "guilds"("owner_discord_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "guild_settings_guild_id_key" ON "guild_settings"("guild_id");

-- CreateIndex
CREATE INDEX "guild_features_guild_id_enabled_idx" ON "guild_features"("guild_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "guild_features_guild_id_feature_key_key" ON "guild_features"("guild_id", "feature_key");

-- CreateIndex
CREATE INDEX "guild_members_user_id_idx" ON "guild_members"("user_id");

-- CreateIndex
CREATE INDEX "guild_members_guild_id_is_member_idx" ON "guild_members"("guild_id", "is_member");

-- CreateIndex
CREATE UNIQUE INDEX "guild_members_guild_id_discord_user_id_key" ON "guild_members"("guild_id", "discord_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "guild_members_id_guild_id_key" ON "guild_members"("id", "guild_id");

-- CreateIndex
CREATE INDEX "guild_member_roles_member_id_discord_role_id_removed_at_idx" ON "guild_member_roles"("member_id", "discord_role_id", "removed_at");

-- CreateIndex
CREATE INDEX "guild_member_roles_guild_id_discord_role_id_idx" ON "guild_member_roles"("guild_id", "discord_role_id");

-- CreateIndex
CREATE INDEX "guild_roles_guild_id_position_idx" ON "guild_roles"("guild_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "guild_roles_guild_id_discord_role_id_key" ON "guild_roles"("guild_id", "discord_role_id");

-- CreateIndex
CREATE INDEX "guild_channels_guild_id_type_idx" ON "guild_channels"("guild_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "guild_channels_guild_id_discord_channel_id_key" ON "guild_channels"("guild_id", "discord_channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_roles_guild_id_discord_role_id_key" ON "permission_roles"("guild_id", "discord_role_id");

-- CreateIndex
CREATE INDEX "permission_overrides_guild_id_permission_key_idx" ON "permission_overrides"("guild_id", "permission_key");

-- CreateIndex
CREATE UNIQUE INDEX "permission_overrides_guild_id_subject_type_subject_discord__key" ON "permission_overrides"("guild_id", "subject_type", "subject_discord_id", "permission_key");

-- CreateIndex
CREATE INDEX "moderation_cases_guild_id_target_discord_user_id_created_at_idx" ON "moderation_cases"("guild_id", "target_discord_user_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_cases_guild_id_moderator_discord_user_id_created_idx" ON "moderation_cases"("guild_id", "moderator_discord_user_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_cases_guild_id_action_idx" ON "moderation_cases"("guild_id", "action");

-- CreateIndex
CREATE INDEX "moderation_cases_guild_id_status_idx" ON "moderation_cases"("guild_id", "status");

-- CreateIndex
CREATE INDEX "moderation_cases_expires_at_idx" ON "moderation_cases"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "moderation_cases_guild_id_case_number_key" ON "moderation_cases"("guild_id", "case_number");

-- CreateIndex
CREATE INDEX "warnings_guild_id_target_discord_user_id_created_at_idx" ON "warnings"("guild_id", "target_discord_user_id", "created_at");

-- CreateIndex
CREATE INDEX "appeals_guild_id_status_submitted_at_idx" ON "appeals"("guild_id", "status", "submitted_at");

-- CreateIndex
CREATE INDEX "audit_logs_guild_id_created_at_idx" ON "audit_logs"("guild_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "security_events_guild_id_created_at_idx" ON "security_events"("guild_id", "created_at");

-- CreateIndex
CREATE INDEX "security_events_guild_id_severity_resolved_idx" ON "security_events"("guild_id", "severity", "resolved");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_entities_guild_id_entity_type_discord_id_key" ON "trusted_entities"("guild_id", "entity_type", "discord_id");

-- CreateIndex
CREATE INDEX "lockdowns_guild_id_started_at_idx" ON "lockdowns"("guild_id", "started_at");

-- CreateIndex
CREATE INDEX "lockdowns_guild_id_ended_at_expires_at_idx" ON "lockdowns"("guild_id", "ended_at", "expires_at");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_settings" ADD CONSTRAINT "guild_settings_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_features" ADD CONSTRAINT "guild_features_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_member_roles" ADD CONSTRAINT "guild_member_roles_member_id_guild_id_fkey" FOREIGN KEY ("member_id", "guild_id") REFERENCES "guild_members"("id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_roles" ADD CONSTRAINT "guild_roles_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_channels" ADD CONSTRAINT "guild_channels_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_roles" ADD CONSTRAINT "permission_roles_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_related_case_id_fkey" FOREIGN KEY ("related_case_id") REFERENCES "moderation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "moderation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "moderation_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_entities" ADD CONSTRAINT "trusted_entities_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lockdowns" ADD CONSTRAINT "lockdowns_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce the allowed permission override effects from the database specification.
ALTER TABLE "permission_overrides"
ADD CONSTRAINT "permission_overrides_effect_check"
CHECK ("effect" IN ('allow', 'deny'));
