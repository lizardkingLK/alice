-- AlterEnum: allow view_shared notifications
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'view_shared';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SavedViewShareMode" AS ENUM (
    'project_members',
    'team_members',
    'users'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "saved_views" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "pathname" TEXT NOT NULL,
  "search" TEXT NOT NULL DEFAULT '',
  "project_id" UUID,
  "status" "RecordStatus" NOT NULL DEFAULT 'active',
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "saved_view_shares" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "view_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "share_mode" "SavedViewShareMode" NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'active',
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_view_shares_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "saved_views"
  DROP CONSTRAINT IF EXISTS "saved_views_owner_id_fkey",
  ADD CONSTRAINT "saved_views_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_views"
  DROP CONSTRAINT IF EXISTS "saved_views_project_id_fkey",
  ADD CONSTRAINT "saved_views_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "saved_views"
  DROP CONSTRAINT IF EXISTS "saved_views_created_by_fkey",
  ADD CONSTRAINT "saved_views_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "saved_views"
  DROP CONSTRAINT IF EXISTS "saved_views_updated_by_fkey",
  ADD CONSTRAINT "saved_views_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "saved_view_shares"
  DROP CONSTRAINT IF EXISTS "saved_view_shares_view_id_fkey",
  ADD CONSTRAINT "saved_view_shares_view_id_fkey"
  FOREIGN KEY ("view_id") REFERENCES "saved_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_view_shares"
  DROP CONSTRAINT IF EXISTS "saved_view_shares_user_id_fkey",
  ADD CONSTRAINT "saved_view_shares_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_view_shares"
  DROP CONSTRAINT IF EXISTS "saved_view_shares_created_by_fkey",
  ADD CONSTRAINT "saved_view_shares_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "saved_view_shares"
  DROP CONSTRAINT IF EXISTS "saved_view_shares_updated_by_fkey",
  ADD CONSTRAINT "saved_view_shares_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "saved_view_shares_view_id_user_id_key"
  ON "saved_view_shares"("view_id", "user_id");

CREATE INDEX IF NOT EXISTS "saved_views_owner_id_status_idx"
  ON "saved_views"("owner_id", "status");

CREATE INDEX IF NOT EXISTS "saved_views_project_id_idx"
  ON "saved_views"("project_id");

CREATE INDEX IF NOT EXISTS "saved_view_shares_user_id_status_idx"
  ON "saved_view_shares"("user_id", "status");

-- Restore Supabase Data API access after Prisma DDL.
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
