CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "discord_user_id" VARCHAR(32) NOT NULL,
  "username" VARCHAR(100) NOT NULL,
  "display_name" VARCHAR(100) NOT NULL,
  "avatar_url" TEXT NOT NULL,
  "locale" VARCHAR(10) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_login_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_accounts" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "provider" VARCHAR(50) NOT NULL,
  "provider_account_id" VARCHAR(128) NOT NULL,
  "scopes" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "session_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guilds" (
  "id" UUID NOT NULL,
  "discord_guild_id" VARCHAR(32) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "icon_url" TEXT NOT NULL,
  "owner_discord_user_id" VARCHAR(32) NOT NULL,
  "active" BOOLEAN NOT NULL,
  "bot_joined_at" TIMESTAMPTZ(6),
  "last_seen_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guild_settings" (
  "id" UUID NOT NULL,
  "guild_id" UUID NOT NULL,
  "locale" VARCHAR(10) NOT NULL,
  "timezone" VARCHAR(64) NOT NULL,
  "prefix" VARCHAR(20),
  "default_log_channel_id" VARCHAR(32),
  "default_staff_role_id" VARCHAR(32),
  "config" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guild_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guild_features" (
  "id" UUID NOT NULL,
  "guild_id" UUID NOT NULL,
  "feature_key" VARCHAR(100) NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "config" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guild_features_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guild_members" (
  "id" UUID NOT NULL,
  "guild_id" UUID NOT NULL,
  "user_id" UUID,
  "discord_user_id" VARCHAR(32) NOT NULL,
  "nickname" VARCHAR(100),
  "joined_at" TIMESTAMPTZ(6) NOT NULL,
  "left_at" TIMESTAMPTZ(6),
  "is_member" BOOLEAN NOT NULL,
  "is_verified" BOOLEAN NOT NULL,
  "metadata" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guild_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guild_member_roles" (
  "id" UUID NOT NULL,
  "guild_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "discord_role_id" VARCHAR(32) NOT NULL,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL,
  "removed_at" TIMESTAMPTZ(6),
  CONSTRAINT "guild_member_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guild_roles" (
  "id" UUID NOT NULL,
  "guild_id" UUID NOT NULL,
  "discord_role_id" VARCHAR(32) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "position" INTEGER NOT NULL,
  "managed" BOOLEAN NOT NULL,
  "permissions" TEXT NOT NULL,
  "color" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guild_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guild_channels" (
  "id" UUID NOT NULL,
  "guild_id" UUID NOT NULL,
  "discord_channel_id" VARCHAR(32) NOT NULL,
  "parent_discord_channel_id" VARCHAR(32),
  "name" VARCHAR(100) NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guild_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permission_roles" (
  "id" UUID NOT NULL,
  "guild_id" UUID NOT NULL,
  "discord_role_id" VARCHAR(32) NOT NULL,
  "permission_set" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permission_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permission_overrides" (
  "id" UUID NOT NULL,
  "guild_id" UUID NOT NULL,
  "subject_type" VARCHAR(30) NOT NULL,
  "subject_discord_id" VARCHAR(32) NOT NULL,
  "permission_key" VARCHAR(150) NOT NULL,
  "effect" VARCHAR(10) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permission_overrides_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "moderation_cases" (
  "id" UUID NOT NULL,
  "guild_id" UUID NOT NULL,
  "case_number" BIGINT NOT NULL,
  "target_discord_user_id" VARCHAR(32) NOT NULL,
  "moderator_discord_user_id" VARCHAR(32) NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "duration_seconds" BIGINT,
  "status" VARCHAR(30) NOT NULL,
  "related_case_id" UUID,
  "expires_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "warnings" (
  "id" UUID NOT NULL,
  "guild_id" UUID NOT NULL,
  "target_discord_user_id" VARCHAR(32) NOT NULL,
  "moderator_discord_user_id" VARCHAR(32) NOT NULL,
  "reason" TEXT NOT NULL,
  "case_id" UUID,
  "expires_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warnings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "appeals" (
  "id" UUID NOT NULL,
  "guild_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "appellant_discord_user_id" VARCHAR(32) NOT NULL,
  "status" VARCHAR(30) NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "decision" TEXT,
  "reviewer_discord_user_id" VARCHAR(32),
  "submitted_at" TIMESTAMPTZ(6) NOT NULL,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plans" (
  "id" UUID NOT NULL,
  "key" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plan_features" (
  "id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "feature_key" VARCHAR(150) NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "limit_value" BIGINT,
  "limit_unit" VARCHAR(50),
  "config" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feature_flags" (
  "id" UUID NOT NULL,
  "key" VARCHAR(150) NOT NULL,
  "state" VARCHAR(20) NOT NULL,
  "config" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feature_flag_overrides" (
  "id" UUID NOT NULL,
  "feature_flag_id" UUID NOT NULL,
  "scope_type" VARCHAR(30) NOT NULL,
  "scope_id" VARCHAR(100) NOT NULL,
  "state" VARCHAR(20) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_flag_overrides_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "idempotency_keys" (
  "id" UUID NOT NULL,
  "scope" VARCHAR(100) NOT NULL,
  "key_hash" VARCHAR(128) NOT NULL,
  "request_hash" VARCHAR(128) NOT NULL,
  "response_status" INTEGER,
  "response_body" JSONB,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_discord_user_id_key" ON "users"("discord_user_id");
CREATE INDEX "users_last_login_at_idx" ON "users"("last_login_at");
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key" ON "oauth_accounts"("provider", "provider_account_id");
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");
CREATE UNIQUE INDEX "guilds_discord_guild_id_key" ON "guilds"("discord_guild_id");
CREATE INDEX "guilds_active_idx" ON "guilds"("active");
CREATE INDEX "guilds_owner_discord_user_id_idx" ON "guilds"("owner_discord_user_id");
CREATE UNIQUE INDEX "guild_settings_guild_id_key" ON "guild_settings"("guild_id");
CREATE UNIQUE INDEX "guild_features_guild_id_feature_key_key" ON "guild_features"("guild_id", "feature_key");
CREATE INDEX "guild_features_guild_id_enabled_idx" ON "guild_features"("guild_id", "enabled");
CREATE UNIQUE INDEX "guild_members_guild_id_discord_user_id_key" ON "guild_members"("guild_id", "discord_user_id");
CREATE INDEX "guild_members_guild_id_is_member_idx" ON "guild_members"("guild_id", "is_member");
CREATE INDEX "guild_members_user_id_idx" ON "guild_members"("user_id");
CREATE INDEX "guild_member_roles_member_id_discord_role_id_idx" ON "guild_member_roles"("member_id", "discord_role_id");
CREATE INDEX "guild_member_roles_guild_id_removed_at_idx" ON "guild_member_roles"("guild_id", "removed_at");
CREATE UNIQUE INDEX "guild_member_roles_active_unique" ON "guild_member_roles"("member_id", "discord_role_id") WHERE "removed_at" IS NULL;
CREATE UNIQUE INDEX "guild_roles_guild_id_discord_role_id_key" ON "guild_roles"("guild_id", "discord_role_id");
CREATE INDEX "guild_roles_guild_id_position_idx" ON "guild_roles"("guild_id", "position");
CREATE UNIQUE INDEX "guild_channels_guild_id_discord_channel_id_key" ON "guild_channels"("guild_id", "discord_channel_id");
CREATE INDEX "guild_channels_guild_id_type_idx" ON "guild_channels"("guild_id", "type");
CREATE UNIQUE INDEX "permission_roles_guild_id_discord_role_id_key" ON "permission_roles"("guild_id", "discord_role_id");
CREATE INDEX "permission_overrides_guild_id_permission_key_idx" ON "permission_overrides"("guild_id", "permission_key");
CREATE UNIQUE INDEX "moderation_cases_guild_id_case_number_key" ON "moderation_cases"("guild_id", "case_number");
CREATE INDEX "moderation_cases_target_discord_user_id_idx" ON "moderation_cases"("target_discord_user_id");
CREATE INDEX "moderation_cases_moderator_discord_user_id_idx" ON "moderation_cases"("moderator_discord_user_id");
CREATE INDEX "moderation_cases_action_idx" ON "moderation_cases"("action");
CREATE INDEX "moderation_cases_status_idx" ON "moderation_cases"("status");
CREATE INDEX "moderation_cases_created_at_idx" ON "moderation_cases"("created_at");
CREATE INDEX "moderation_cases_expires_at_idx" ON "moderation_cases"("expires_at");
CREATE INDEX "warnings_guild_id_target_discord_user_id_created_at_idx" ON "warnings"("guild_id", "target_discord_user_id", "created_at");
CREATE INDEX "warnings_expires_at_idx" ON "warnings"("expires_at");
CREATE INDEX "appeals_guild_id_status_submitted_at_idx" ON "appeals"("guild_id", "status", "submitted_at");
CREATE INDEX "appeals_case_id_idx" ON "appeals"("case_id");
CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");
CREATE UNIQUE INDEX "plan_features_plan_id_feature_key_key" ON "plan_features"("plan_id", "feature_key");
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");
CREATE UNIQUE INDEX "feature_flag_overrides_feature_flag_id_scope_type_scope_id_key" ON "feature_flag_overrides"("feature_flag_id", "scope_type", "scope_id");
CREATE INDEX "audit_logs_guild_id_created_at_idx" ON "audit_logs"("guild_id", "created_at");
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");
CREATE UNIQUE INDEX "idempotency_keys_scope_key_hash_key" ON "idempotency_keys"("scope", "key_hash");
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guild_settings" ADD CONSTRAINT "guild_settings_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guild_features" ADD CONSTRAINT "guild_features_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guild_member_roles" ADD CONSTRAINT "guild_member_roles_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guild_member_roles" ADD CONSTRAINT "guild_member_roles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "guild_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guild_roles" ADD CONSTRAINT "guild_roles_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guild_channels" ADD CONSTRAINT "guild_channels_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "permission_roles" ADD CONSTRAINT "permission_roles_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_related_case_id_fkey" FOREIGN KEY ("related_case_id") REFERENCES "moderation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "moderation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "moderation_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_feature_flag_id_fkey" FOREIGN KEY ("feature_flag_id") REFERENCES "feature_flags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
