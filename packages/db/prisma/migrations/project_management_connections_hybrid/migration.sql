-- Hybrid PM connections: rename jira_connections → project_management_connections
-- with vendor enum + provider_config JSONB. Preserves UUIDs for projects.jira_connection_id.
-- See docs/guides/RLS_HYBRID_ROLLOUT.md and docs/features/projects/JIRA_INTEGRATION.md.

-- CreateEnum
CREATE TYPE "ProjectManagementVendor" AS ENUM ('jira');

-- CreateEnum
CREATE TYPE "ProjectManagementConnectionStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "project_management_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "vendor" "ProjectManagementVendor" NOT NULL,
    "external_id" TEXT NOT NULL,
    "display_label" TEXT,
    "provider_config" JSONB NOT NULL DEFAULT '{}',
    "refresh_token_enc" TEXT NOT NULL,
    "access_token_enc" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(6),
    "scopes" TEXT NOT NULL,
    "status" "ProjectManagementConnectionStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_management_connections_pkey" PRIMARY KEY ("id")
);

-- Copy existing Jira OAuth rows (same ids)
INSERT INTO "project_management_connections" (
    "id",
    "user_id",
    "vendor",
    "external_id",
    "display_label",
    "provider_config",
    "refresh_token_enc",
    "access_token_enc",
    "access_token_expires_at",
    "scopes",
    "status",
    "created_at",
    "updated_at"
)
SELECT
    j."id",
    j."user_id",
    'jira'::"ProjectManagementVendor",
    j."cloud_id",
    j."site_url",
    jsonb_build_object(
      'site_url', j."site_url",
      'account_email', j."account_email"
    ),
    j."refresh_token_enc",
    j."access_token_enc",
    j."access_token_expires_at",
    j."scopes",
    j."status"::text::"ProjectManagementConnectionStatus",
    j."created_at",
    j."updated_at"
FROM "jira_connections" j;

-- Point projects FK at the new table (ids unchanged)
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_jira_connection_id_fkey";

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_jira_connection_id_fkey"
  FOREIGN KEY ("jira_connection_id")
  REFERENCES "project_management_connections"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Indexes / unique / FK on new table
CREATE INDEX "project_management_connections_user_id_idx"
  ON "project_management_connections"("user_id");

CREATE INDEX "project_management_connections_vendor_idx"
  ON "project_management_connections"("vendor");

CREATE UNIQUE INDEX "project_management_connections_user_id_vendor_external_id_key"
  ON "project_management_connections"("user_id", "vendor", "external_id");

ALTER TABLE "project_management_connections"
  ADD CONSTRAINT "project_management_connections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Drop old table + enum
DROP TABLE IF EXISTS "jira_connections";
DROP TYPE IF EXISTS "JiraConnectionStatus";

-- RLS: service-role / Prisma only (same P0 secrets pattern)
ALTER TABLE "project_management_connections" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "project_management_connections" FROM anon, authenticated;

-- Restore Supabase Data API access after Prisma DDL.
-- Prisma runs as postgres; PostgREST uses anon, authenticated, and service_role.
-- Without these grants, seed (service_role) and client queries fail with
-- "permission denied for schema public".

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON ROUTINES TO anon, authenticated;

-- Hybrid RLS P0: re-lock secrets / admission tables after the blanket GRANTs above.
-- See docs/guides/RLS_HYBRID_ROLLOUT.md. Idempotent for migrate:deploy / create:migrate.
REVOKE ALL ON TABLE public.integrations FROM anon, authenticated;
REVOKE ALL ON TABLE public.project_management_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.chat_attachments FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_allowlist FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_requests FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon, authenticated;
