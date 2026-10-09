CREATE TABLE "automod_rules" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "name" VARCHAR(100) NOT NULL, "type" VARCHAR(50) NOT NULL,
  "enabled" BOOLEAN NOT NULL, "priority" INTEGER NOT NULL, "conditions" JSONB NOT NULL, "exemptions" JSONB NOT NULL,
  "threshold" JSONB NOT NULL, "actions" JSONB NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "automod_rules_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "automod_events" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "rule_id" UUID, "discord_user_id" VARCHAR(32) NOT NULL,
  "channel_id" VARCHAR(32), "message_id" VARCHAR(32), "action" VARCHAR(50) NOT NULL, "metadata" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "automod_events_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "security_events" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "event_type" VARCHAR(100) NOT NULL, "severity" VARCHAR(20) NOT NULL,
  "actor_discord_user_id" VARCHAR(32), "target_discord_id" VARCHAR(32), "metadata" JSONB NOT NULL,
  "resolved" BOOLEAN NOT NULL, "resolved_by_discord_user_id" VARCHAR(32), "resolved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "trusted_entities" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "entity_type" VARCHAR(30) NOT NULL, "discord_id" VARCHAR(32) NOT NULL,
  "reason" TEXT, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "trusted_entities_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "lockdowns" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "scope_type" VARCHAR(30) NOT NULL, "scope_id" VARCHAR(32),
  "reason" TEXT NOT NULL, "trigger_type" VARCHAR(30) NOT NULL, "started_at" TIMESTAMPTZ(6) NOT NULL,
  "expires_at" TIMESTAMPTZ(6), "ended_at" TIMESTAMPTZ(6), "started_by_discord_user_id" VARCHAR(32),
  "ended_by_discord_user_id" VARCHAR(32), CONSTRAINT "lockdowns_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "verification_configs" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "method" VARCHAR(50) NOT NULL, "enabled" BOOLEAN NOT NULL,
  "verification_channel_id" VARCHAR(32), "verified_role_id" VARCHAR(32), "unverified_role_id" VARCHAR(32),
  "account_age_days" INTEGER, "config" JSONB NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "verification_configs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "verification_attempts" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "discord_user_id" VARCHAR(32) NOT NULL, "status" VARCHAR(30) NOT NULL,
  "method" VARCHAR(50) NOT NULL, "metadata" JSONB NOT NULL, "attempted_at" TIMESTAMPTZ(6) NOT NULL,
  "completed_at" TIMESTAMPTZ(6), CONSTRAINT "verification_attempts_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "welcome_configs" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "enabled" BOOLEAN NOT NULL, "channel_id" VARCHAR(32),
  "message_template" TEXT, "embed_config" JSONB NOT NULL, "image_config" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "welcome_configs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "goodbye_configs" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "enabled" BOOLEAN NOT NULL, "channel_id" VARCHAR(32),
  "message_template" TEXT, "embed_config" JSONB NOT NULL, "image_config" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goodbye_configs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "log_configs" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "event_type" VARCHAR(100) NOT NULL, "channel_id" VARCHAR(32) NOT NULL,
  "enabled" BOOLEAN NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "log_configs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "log_events" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "event_type" VARCHAR(100) NOT NULL, "actor_discord_user_id" VARCHAR(32),
  "target_discord_id" VARCHAR(32), "channel_id" VARCHAR(32), "message_id" VARCHAR(32), "payload" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "log_events_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "level_configs" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "enabled" BOOLEAN NOT NULL, "xp_per_message" INTEGER NOT NULL,
  "cooldown_seconds" INTEGER NOT NULL, "multiplier" DECIMAL(8,3) NOT NULL, "ignored_channels" JSONB NOT NULL,
  "ignored_roles" JSONB NOT NULL, "level_formula" VARCHAR(100) NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "level_configs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "member_levels" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "discord_user_id" VARCHAR(32) NOT NULL, "xp" BIGINT NOT NULL,
  "level" INTEGER NOT NULL, "messages_count" BIGINT NOT NULL, "last_xp_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "member_levels_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "forms" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "name" VARCHAR(100) NOT NULL, "description" TEXT NOT NULL,
  "status" VARCHAR(30) NOT NULL, "version" INTEGER NOT NULL, "config" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "form_fields" (
  "id" UUID NOT NULL, "form_id" UUID NOT NULL, "field_key" VARCHAR(100) NOT NULL, "label" VARCHAR(200) NOT NULL,
  "type" VARCHAR(50) NOT NULL, "required" BOOLEAN NOT NULL, "position" INTEGER NOT NULL, "config" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "form_submissions" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "form_id" UUID NOT NULL, "submitted_by_discord_user_id" VARCHAR(32) NOT NULL,
  "status" VARCHAR(30) NOT NULL, "answers" JSONB NOT NULL, "reviewed_by_discord_user_id" VARCHAR(32),
  "reviewed_at" TIMESTAMPTZ(6), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ticket_panels" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "name" VARCHAR(100) NOT NULL, "channel_id" VARCHAR(32) NOT NULL,
  "message_id" VARCHAR(32), "config" JSONB NOT NULL, "enabled" BOOLEAN NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_panels_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ticket_categories" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "name" VARCHAR(100) NOT NULL, "staff_roles" JSONB NOT NULL,
  "priority" INTEGER NOT NULL, "form_id" UUID, "config" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "tickets" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "ticket_number" BIGINT NOT NULL,
  "creator_discord_user_id" VARCHAR(32) NOT NULL, "channel_id" VARCHAR(32) NOT NULL, "category_id" UUID,
  "status" VARCHAR(30) NOT NULL, "priority" VARCHAR(20) NOT NULL, "claimed_by_discord_user_id" VARCHAR(32),
  "closed_by_discord_user_id" VARCHAR(32), "opened_at" TIMESTAMPTZ(6) NOT NULL, "closed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ticket_participants" (
  "id" UUID NOT NULL, "ticket_id" UUID NOT NULL, "discord_user_id" VARCHAR(32) NOT NULL,
  "participant_type" VARCHAR(30) NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_participants_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ticket_notes" (
  "id" UUID NOT NULL, "ticket_id" UUID NOT NULL, "author_discord_user_id" VARCHAR(32) NOT NULL,
  "content" TEXT NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_notes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ticket_transcripts" (
  "id" UUID NOT NULL, "ticket_id" UUID NOT NULL, "storage_type" VARCHAR(30) NOT NULL,
  "storage_reference" TEXT NOT NULL, "message_count" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ticket_transcripts_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "role_menus" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "name" VARCHAR(100) NOT NULL, "channel_id" VARCHAR(32) NOT NULL,
  "message_id" VARCHAR(32), "type" VARCHAR(30) NOT NULL, "config" JSONB NOT NULL, "enabled" BOOLEAN NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_menus_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "role_menu_options" (
  "id" UUID NOT NULL, "role_menu_id" UUID NOT NULL, "value" VARCHAR(100) NOT NULL, "label" VARCHAR(100) NOT NULL,
  "description" TEXT, "emoji" VARCHAR(100), "role_id" VARCHAR(32) NOT NULL, "position" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_menu_options_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "subscriptions" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "plan_id" UUID NOT NULL, "provider" VARCHAR(50) NOT NULL,
  "provider_subscription_id" VARCHAR(255), "status" VARCHAR(30) NOT NULL,
  "current_period_start" TIMESTAMPTZ(6) NOT NULL, "current_period_end" TIMESTAMPTZ(6) NOT NULL,
  "cancel_at_period_end" BOOLEAN NOT NULL, "grace_until" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "entitlements" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "feature_key" VARCHAR(150) NOT NULL, "source_type" VARCHAR(30) NOT NULL,
  "source_id" UUID, "enabled" BOOLEAN NOT NULL, "limit_value" BIGINT, "expires_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "payments" (
  "id" UUID NOT NULL, "guild_id" UUID NOT NULL, "subscription_id" UUID, "provider" VARCHAR(50) NOT NULL,
  "provider_payment_id" VARCHAR(255) NOT NULL, "amount_minor" BIGINT NOT NULL, "currency" VARCHAR(10) NOT NULL,
  "status" VARCHAR(30) NOT NULL, "paid_at" TIMESTAMPTZ(6), "metadata" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "automod_rules_guild_id_enabled_priority_idx" ON "automod_rules"("guild_id", "enabled", "priority");
CREATE INDEX "automod_events_guild_id_created_at_idx" ON "automod_events"("guild_id", "created_at");
CREATE INDEX "automod_events_discord_user_id_created_at_idx" ON "automod_events"("discord_user_id", "created_at");
CREATE INDEX "automod_events_rule_id_created_at_idx" ON "automod_events"("rule_id", "created_at");
CREATE INDEX "security_events_guild_id_created_at_idx" ON "security_events"("guild_id", "created_at");
CREATE INDEX "security_events_guild_id_severity_resolved_idx" ON "security_events"("guild_id", "severity", "resolved");
CREATE UNIQUE INDEX "trusted_entities_guild_id_entity_type_discord_id_key" ON "trusted_entities"("guild_id", "entity_type", "discord_id");
CREATE INDEX "lockdowns_guild_id_started_at_idx" ON "lockdowns"("guild_id", "started_at");
CREATE INDEX "lockdowns_expires_at_idx" ON "lockdowns"("expires_at");
CREATE UNIQUE INDEX "verification_configs_guild_id_key" ON "verification_configs"("guild_id");
CREATE INDEX "verification_attempts_guild_id_discord_user_id_attempted_at_idx" ON "verification_attempts"("guild_id", "discord_user_id", "attempted_at");
CREATE UNIQUE INDEX "welcome_configs_guild_id_key" ON "welcome_configs"("guild_id");
CREATE UNIQUE INDEX "goodbye_configs_guild_id_key" ON "goodbye_configs"("guild_id");
CREATE UNIQUE INDEX "log_configs_guild_id_event_type_key" ON "log_configs"("guild_id", "event_type");
CREATE INDEX "log_events_guild_id_created_at_idx" ON "log_events"("guild_id", "created_at");
CREATE UNIQUE INDEX "level_configs_guild_id_key" ON "level_configs"("guild_id");
CREATE UNIQUE INDEX "member_levels_guild_id_discord_user_id_key" ON "member_levels"("guild_id", "discord_user_id");
CREATE INDEX "member_levels_guild_id_xp_idx" ON "member_levels"("guild_id", "xp");
CREATE INDEX "forms_guild_id_status_idx" ON "forms"("guild_id", "status");
CREATE UNIQUE INDEX "form_fields_form_id_field_key_key" ON "form_fields"("form_id", "field_key");
CREATE INDEX "form_fields_form_id_position_idx" ON "form_fields"("form_id", "position");
CREATE INDEX "form_submissions_guild_id_form_id_status_created_at_idx" ON "form_submissions"("guild_id", "form_id", "status", "created_at");
CREATE INDEX "ticket_panels_guild_id_enabled_idx" ON "ticket_panels"("guild_id", "enabled");
CREATE INDEX "ticket_categories_guild_id_priority_idx" ON "ticket_categories"("guild_id", "priority");
CREATE UNIQUE INDEX "tickets_guild_id_ticket_number_key" ON "tickets"("guild_id", "ticket_number");
CREATE INDEX "tickets_guild_id_status_opened_at_idx" ON "tickets"("guild_id", "status", "opened_at");
CREATE INDEX "tickets_creator_discord_user_id_idx" ON "tickets"("creator_discord_user_id");
CREATE UNIQUE INDEX "ticket_participants_ticket_id_discord_user_id_key" ON "ticket_participants"("ticket_id", "discord_user_id");
CREATE INDEX "ticket_notes_ticket_id_created_at_idx" ON "ticket_notes"("ticket_id", "created_at");
CREATE INDEX "ticket_transcripts_ticket_id_created_at_idx" ON "ticket_transcripts"("ticket_id", "created_at");
CREATE INDEX "role_menus_guild_id_enabled_idx" ON "role_menus"("guild_id", "enabled");
CREATE INDEX "role_menu_options_role_menu_id_position_idx" ON "role_menu_options"("role_menu_id", "position");
CREATE INDEX "subscriptions_guild_id_status_idx" ON "subscriptions"("guild_id", "status");
CREATE INDEX "subscriptions_current_period_end_idx" ON "subscriptions"("current_period_end");
CREATE INDEX "entitlements_guild_id_feature_key_idx" ON "entitlements"("guild_id", "feature_key");
CREATE INDEX "entitlements_expires_at_idx" ON "entitlements"("expires_at");
CREATE UNIQUE INDEX "payments_provider_provider_payment_id_key" ON "payments"("provider", "provider_payment_id");
CREATE INDEX "payments_guild_id_status_created_at_idx" ON "payments"("guild_id", "status", "created_at");

ALTER TABLE "automod_rules" ADD CONSTRAINT "automod_rules_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "automod_events" ADD CONSTRAINT "automod_events_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "automod_events" ADD CONSTRAINT "automod_events_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automod_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trusted_entities" ADD CONSTRAINT "trusted_entities_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lockdowns" ADD CONSTRAINT "lockdowns_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_configs" ADD CONSTRAINT "verification_configs_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_attempts" ADD CONSTRAINT "verification_attempts_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "welcome_configs" ADD CONSTRAINT "welcome_configs_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goodbye_configs" ADD CONSTRAINT "goodbye_configs_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "log_configs" ADD CONSTRAINT "log_configs_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "log_events" ADD CONSTRAINT "log_events_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "level_configs" ADD CONSTRAINT "level_configs_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "member_levels" ADD CONSTRAINT "member_levels_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "forms" ADD CONSTRAINT "forms_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_panels" ADD CONSTRAINT "ticket_panels_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ticket_participants" ADD CONSTRAINT "ticket_participants_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_notes" ADD CONSTRAINT "ticket_notes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_transcripts" ADD CONSTRAINT "ticket_transcripts_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_menus" ADD CONSTRAINT "role_menus_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_menu_options" ADD CONSTRAINT "role_menu_options_role_menu_id_fkey" FOREIGN KEY ("role_menu_id") REFERENCES "role_menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
