-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('active', 'inactive', 'archived', 'deleted');

-- DropForeignKey
ALTER TABLE "work_items" DROP CONSTRAINT "work_items_reporter_id_fkey";

-- attachments: migrate uploaded_at -> created_at, add audit columns
ALTER TABLE "attachments"
ADD COLUMN "created_at" TIMESTAMPTZ(6),
ADD COLUMN "created_by" UUID,
ADD COLUMN "status" "RecordStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_by" UUID;

UPDATE "attachments"
SET
  "created_at" = COALESCE("uploaded_at", CURRENT_TIMESTAMP),
  "created_by" = "uploader_id";

ALTER TABLE "attachments"
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "attachments" DROP COLUMN "uploaded_at";

-- comments
ALTER TABLE "comments"
ADD COLUMN "created_by" UUID,
ADD COLUMN "status" "RecordStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "updated_by" UUID;

UPDATE "comments"
SET "created_by" = "author_id"
WHERE "created_by" IS NULL;

-- instruments
ALTER TABLE "instruments"
ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "created_by" UUID,
ADD COLUMN "status" "RecordStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_by" UUID;

-- notifications
ALTER TABLE "notifications"
ADD COLUMN "created_by" UUID,
ADD COLUMN "status" "RecordStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_by" UUID;

UPDATE "notifications"
SET "updated_at" = COALESCE("created_at", CURRENT_TIMESTAMP);

-- project_members: migrate joined_at -> created_at
ALTER TABLE "project_members"
ADD COLUMN "created_at" TIMESTAMPTZ(6),
ADD COLUMN "created_by" UUID,
ADD COLUMN "status" "RecordStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_by" UUID;

UPDATE "project_members"
SET "created_at" = COALESCE("joined_at", CURRENT_TIMESTAMP);

ALTER TABLE "project_members"
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "project_members" DROP COLUMN "joined_at";

-- projects
ALTER TABLE "projects"
ADD COLUMN "created_by" UUID,
ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_by" UUID;

UPDATE "projects"
SET
  "created_by" = "owner_id",
  "updated_at" = COALESCE("created_at", CURRENT_TIMESTAMP);

-- sprints
ALTER TABLE "sprints"
ADD COLUMN "created_by" UUID,
ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_by" UUID;

UPDATE "sprints"
SET "updated_at" = COALESCE("created_at", CURRENT_TIMESTAMP);

-- team_members
ALTER TABLE "team_members"
ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "created_by" UUID,
ADD COLUMN "status" "RecordStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_by" UUID;

-- teams
ALTER TABLE "teams"
ADD COLUMN "created_by" UUID,
ADD COLUMN "status" "RecordStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_by" UUID;

UPDATE "teams"
SET
  "created_by" = "manager_id",
  "updated_at" = COALESCE("created_at", CURRENT_TIMESTAMP);

-- users
ALTER TABLE "users"
ADD COLUMN "created_by" UUID,
ADD COLUMN "status" "RecordStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_by" UUID;

UPDATE "users"
SET
  "status" = CASE WHEN "active" THEN 'active'::"RecordStatus" ELSE 'inactive'::"RecordStatus" END,
  "updated_at" = COALESCE("created_at", CURRENT_TIMESTAMP);

-- work_items
ALTER TABLE "work_items"
ADD COLUMN "created_by" UUID,
ADD COLUMN "updated_by" UUID,
ALTER COLUMN "reporter_id" DROP NOT NULL;

UPDATE "work_items"
SET "created_by" = "reporter_id"
WHERE "created_by" IS NULL AND "reporter_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "instruments" ADD CONSTRAINT "instruments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "users_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projects" ADD CONSTRAINT "projects_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_members" ADD CONSTRAINT "project_members_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_members" ADD CONSTRAINT "project_members_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "teams" ADD CONSTRAINT "teams_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "team_members" ADD CONSTRAINT "team_members_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "team_members" ADD CONSTRAINT "team_members_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sprints" ADD CONSTRAINT "sprints_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sprints" ADD CONSTRAINT "sprints_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_items" ADD CONSTRAINT "work_items_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_items" ADD CONSTRAINT "work_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_items" ADD CONSTRAINT "work_items_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "comments" ADD CONSTRAINT "comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "comments" ADD CONSTRAINT "comments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attachments" ADD CONSTRAINT "attachments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attachments" ADD CONSTRAINT "attachments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
