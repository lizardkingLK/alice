-- Project-scoped Figma OAuth credentials and single-use OAuth attempts.
-- Both tables are service-role/Prisma only because they contain secrets.

CREATE TABLE "figma_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "authorized_by" UUID NOT NULL,
    "figma_user_id" TEXT NOT NULL,
    "access_token_enc" TEXT NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "access_token_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "scopes" TEXT NOT NULL,
    "verified_file_key" TEXT,
    "verified_file_name" TEXT,
    "verified_at" TIMESTAMPTZ(6),
    "verification_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "figma_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "figma_oauth_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nonce_hash" TEXT NOT NULL,
    "code_verifier_enc" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "figma_oauth_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "figma_connections_project_id_key"
  ON "figma_connections"("project_id");
CREATE INDEX "figma_connections_authorized_by_idx"
  ON "figma_connections"("authorized_by");
CREATE UNIQUE INDEX "figma_oauth_attempts_nonce_hash_key"
  ON "figma_oauth_attempts"("nonce_hash");
CREATE INDEX "figma_oauth_attempts_project_id_user_id_idx"
  ON "figma_oauth_attempts"("project_id", "user_id");
CREATE INDEX "figma_oauth_attempts_expires_at_idx"
  ON "figma_oauth_attempts"("expires_at");

ALTER TABLE "figma_connections"
  ADD CONSTRAINT "figma_connections_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "figma_connections"
  ADD CONSTRAINT "figma_connections_authorized_by_fkey"
  FOREIGN KEY ("authorized_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "figma_oauth_attempts"
  ADD CONSTRAINT "figma_oauth_attempts_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "figma_oauth_attempts"
  ADD CONSTRAINT "figma_oauth_attempts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "figma_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "figma_oauth_attempts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "figma_connections" FROM anon, authenticated;
REVOKE ALL ON TABLE "figma_oauth_attempts" FROM anon, authenticated;

-- Prisma migrations restore broad Data API grants in several historical
-- migrations. Reassert the Strategy A secret-table boundary here.
GRANT ALL ON TABLE "figma_connections", "figma_oauth_attempts"
  TO postgres, service_role;
REVOKE ALL ON TABLE "figma_connections", "figma_oauth_attempts"
  FROM anon, authenticated;
