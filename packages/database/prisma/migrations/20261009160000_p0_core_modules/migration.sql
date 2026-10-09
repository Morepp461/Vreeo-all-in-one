CREATE TABLE "automod_rules" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "rule_type" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "automod_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "ticket_number" BIGINT NOT NULL,
    "channel_discord_id" VARCHAR(32),
    "opener_discord_user_id" VARCHAR(32) NOT NULL,
    "claimed_by_discord_user_id" VARCHAR(32),
    "status" VARCHAR(30) NOT NULL DEFAULT 'open',
    "subject" VARCHAR(200),
    "close_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "closed_at" TIMESTAMPTZ(6),
    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "feature_key" VARCHAR(100) NOT NULL,
    "plan_key" VARCHAR(30) NOT NULL DEFAULT 'free',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source" VARCHAR(30) NOT NULL DEFAULT 'system',
    "limit_value" INTEGER,
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "automod_rules_guild_id_name_key" ON "automod_rules"("guild_id", "name");
CREATE INDEX "automod_rules_guild_id_enabled_idx" ON "automod_rules"("guild_id", "enabled");
CREATE INDEX "automod_rules_guild_id_rule_type_idx" ON "automod_rules"("guild_id", "rule_type");
CREATE UNIQUE INDEX "tickets_guild_id_ticket_number_key" ON "tickets"("guild_id", "ticket_number");
CREATE UNIQUE INDEX "tickets_guild_id_channel_discord_id_key" ON "tickets"("guild_id", "channel_discord_id");
CREATE INDEX "tickets_guild_id_status_created_at_idx" ON "tickets"("guild_id", "status", "created_at");
CREATE INDEX "tickets_guild_id_opener_discord_user_id_created_at_idx" ON "tickets"("guild_id", "opener_discord_user_id", "created_at");
CREATE UNIQUE INDEX "entitlements_guild_id_feature_key_key" ON "entitlements"("guild_id", "feature_key");
CREATE INDEX "entitlements_guild_id_enabled_expires_at_idx" ON "entitlements"("guild_id", "enabled", "expires_at");
CREATE INDEX "entitlements_plan_key_feature_key_idx" ON "entitlements"("plan_key", "feature_key");

ALTER TABLE "automod_rules"
ADD CONSTRAINT "automod_rules_guild_id_fkey"
FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tickets"
ADD CONSTRAINT "tickets_guild_id_fkey"
FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "entitlements"
ADD CONSTRAINT "entitlements_guild_id_fkey"
FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
