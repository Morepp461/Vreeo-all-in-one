ALTER TABLE "oauth_accounts"
ADD COLUMN "access_token_ciphertext" TEXT,
ADD COLUMN "refresh_token_ciphertext" TEXT,
ADD COLUMN "token_expires_at" TIMESTAMPTZ(6);
