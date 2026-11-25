-- Expand-only foundation for shared Figma OAuth credentials.
-- Existing project connections and legacy encrypted credential columns remain
-- unchanged until a later backfill and contract phase.

CREATE TYPE "FigmaOAuthCredentialStatus" AS ENUM (
  'unknown',
  'active',
  'reauthorization_required'
);

CREATE TABLE "figma_oauth_credentials" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "oauth_app_key" TEXT NOT NULL,
  "figma_user_id" TEXT NOT NULL,
  "access_token_enc" TEXT NOT NULL,
  "refresh_token_enc" TEXT NOT NULL,
  "access_token_expires_at" TIMESTAMPTZ(6) NOT NULL,
  "scopes" TEXT NOT NULL,
  "status" "FigmaOAuthCredentialStatus" NOT NULL DEFAULT 'unknown',
  "token_version" INTEGER NOT NULL DEFAULT 1,
  "last_validated_at" TIMESTAMPTZ(6),
  "last_authorized_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "figma_oauth_credentials_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "figma_connections"
  ADD COLUMN "credential_id" UUID;

CREATE UNIQUE INDEX "figma_oauth_credentials_oauth_app_key_figma_user_id_key"
  ON "figma_oauth_credentials"("oauth_app_key", "figma_user_id");
CREATE INDEX "figma_oauth_credentials_status_idx"
  ON "figma_oauth_credentials"("status");
CREATE INDEX "figma_oauth_credentials_access_token_expires_at_idx"
  ON "figma_oauth_credentials"("access_token_expires_at");
CREATE INDEX "figma_oauth_credentials_last_authorized_by_idx"
  ON "figma_oauth_credentials"("last_authorized_by");
CREATE INDEX "figma_connections_credential_id_idx"
  ON "figma_connections"("credential_id");

ALTER TABLE "figma_oauth_credentials"
  ADD CONSTRAINT "figma_oauth_credentials_last_authorized_by_fkey"
  FOREIGN KEY ("last_authorized_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "figma_connections"
  ADD CONSTRAINT "figma_connections_credential_id_fkey"
  FOREIGN KEY ("credential_id") REFERENCES "figma_oauth_credentials"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Strategy A: credential ciphertext is available only to Prisma/postgres and
-- the service role. PostgREST client roles receive no table privileges.
ALTER TABLE "figma_oauth_credentials" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "figma_oauth_credentials" TO postgres, service_role;
REVOKE ALL ON TABLE "figma_oauth_credentials" FROM anon, authenticated;

-- Reassert the existing Figma secret-table boundaries as part of this migration.
REVOKE ALL ON TABLE "figma_connections" FROM anon, authenticated;
REVOKE ALL ON TABLE "figma_oauth_attempts" FROM anon, authenticated;
