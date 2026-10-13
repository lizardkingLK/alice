-- Replace single-per-owner is_overview with multi-pin dashboard flags.

ALTER TABLE "charts"
  ADD COLUMN IF NOT EXISTS "show_on_dashboard" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "charts"
  ADD COLUMN IF NOT EXISTS "dashboard_sort_order" INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'charts'
      AND column_name = 'is_overview'
  ) THEN
    EXECUTE 'UPDATE "charts" SET "show_on_dashboard" = true WHERE "is_overview" = true';
    DROP INDEX IF EXISTS "charts_owner_overview_active_key";
    ALTER TABLE "charts" DROP COLUMN "is_overview";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "charts_show_on_dashboard_dashboard_sort_order_title_idx"
  ON "charts"("show_on_dashboard", "dashboard_sort_order", "title");

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
