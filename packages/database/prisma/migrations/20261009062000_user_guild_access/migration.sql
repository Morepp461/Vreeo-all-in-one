CREATE TABLE "user_guild_access" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "guild_id" UUID NOT NULL,
  "permissions" TEXT NOT NULL,
  "is_owner" BOOLEAN NOT NULL,
  "last_verified_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_guild_access_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_guild_access_user_id_guild_id_key" ON "user_guild_access"("user_id", "guild_id");
CREATE INDEX "user_guild_access_guild_id_last_verified_at_idx" ON "user_guild_access"("guild_id", "last_verified_at");
CREATE INDEX "user_guild_access_user_id_last_verified_at_idx" ON "user_guild_access"("user_id", "last_verified_at");
ALTER TABLE "user_guild_access" ADD CONSTRAINT "user_guild_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_guild_access" ADD CONSTRAINT "user_guild_access_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
