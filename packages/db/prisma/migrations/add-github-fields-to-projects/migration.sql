-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('assign', 'status_change', 'comment', 'mention', 'sprint', 'due_date');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO notificationtype_old;
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE notificationtype_old;
COMMIT;

-- DropForeignKey
ALTER TABLE "chat_conversations" DROP CONSTRAINT "chat_conversations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "saved_view_shares" DROP CONSTRAINT "saved_view_shares_created_by_fkey";

-- DropForeignKey
ALTER TABLE "saved_view_shares" DROP CONSTRAINT "saved_view_shares_updated_by_fkey";

-- DropForeignKey
ALTER TABLE "saved_view_shares" DROP CONSTRAINT "saved_view_shares_user_id_fkey";

-- DropForeignKey
ALTER TABLE "saved_view_shares" DROP CONSTRAINT "saved_view_shares_view_id_fkey";

-- DropForeignKey
ALTER TABLE "saved_views" DROP CONSTRAINT "saved_views_created_by_fkey";

-- DropForeignKey
ALTER TABLE "saved_views" DROP CONSTRAINT "saved_views_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "saved_views" DROP CONSTRAINT "saved_views_project_id_fkey";

-- DropForeignKey
ALTER TABLE "saved_views" DROP CONSTRAINT "saved_views_updated_by_fkey";

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "github_owner" TEXT,
ADD COLUMN     "github_repo" TEXT,
ADD COLUMN     "github_token" TEXT;

-- DropTable
DROP TABLE "chat_conversations";

-- DropTable
DROP TABLE "saved_view_shares";

-- DropTable
DROP TABLE "saved_views";

-- DropEnum
DROP TYPE SavedViewShareMode;

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
