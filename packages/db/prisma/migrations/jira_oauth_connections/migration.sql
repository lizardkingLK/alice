-- CreateEnum
CREATE TYPE "JiraConnectionStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "jira_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "cloud_id" TEXT NOT NULL,
    "site_url" TEXT NOT NULL,
    "account_email" TEXT,
    "refresh_token_enc" TEXT NOT NULL,
    "access_token_enc" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(6),
    "scopes" TEXT NOT NULL,
    "status" "JiraConnectionStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jira_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jira_connections_user_id_idx" ON "jira_connections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "jira_connections_user_id_cloud_id_key" ON "jira_connections"("user_id", "cloud_id");

-- AddForeignKey
ALTER TABLE "jira_connections" ADD CONSTRAINT "jira_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: link projects to OAuth connections (keeps jira_project_key)
ALTER TABLE "projects" ADD COLUMN "jira_connection_id" UUID;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_jira_connection_id_fkey" FOREIGN KEY ("jira_connection_id") REFERENCES "jira_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- WARNING: data loss — drops interim plaintext Jira credential columns
ALTER TABLE "projects" DROP COLUMN IF EXISTS "jira_url",
DROP COLUMN IF EXISTS "jira_email",
DROP COLUMN IF EXISTS "jira_token";

-- DropTable: interim global API-token settings
DROP TABLE IF EXISTS "jira_settings";

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
