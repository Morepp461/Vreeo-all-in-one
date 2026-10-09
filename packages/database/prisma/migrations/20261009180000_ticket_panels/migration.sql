CREATE TABLE "ticket_panels" (
    "id" UUID NOT NULL,
    "guild_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "channel_discord_id" VARCHAR(32) NOT NULL,
    "message_discord_id" VARCHAR(32),
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "ticket_panels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ticket_panels_guild_id_name_key"
ON "ticket_panels"("guild_id", "name");

CREATE INDEX "ticket_panels_guild_id_enabled_idx"
ON "ticket_panels"("guild_id", "enabled");

ALTER TABLE "ticket_panels"
ADD CONSTRAINT "ticket_panels_guild_id_fkey"
FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
