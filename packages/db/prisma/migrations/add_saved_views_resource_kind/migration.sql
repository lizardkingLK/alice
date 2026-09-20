-- Typed chart workspace bookmarks on saved_views (resource_kind + resource_id).

CREATE TYPE "SavedViewResourceKind" AS ENUM ('page', 'chart');

ALTER TABLE "saved_views"
  ADD COLUMN IF NOT EXISTS "resource_kind" "SavedViewResourceKind" NOT NULL DEFAULT 'page',
  ADD COLUMN IF NOT EXISTS "resource_id" UUID;

-- Backfill existing /charts/{uuid} bookmarks that still point at a live chart.
UPDATE "saved_views" AS sv
SET
  "resource_kind" = 'chart',
  "resource_id" = (substring(sv."pathname" from '^/charts/([0-9a-fA-F-]{36})$'))::uuid
WHERE sv."pathname" ~ '^/charts/[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1
    FROM "charts" AS c
    WHERE c."id" = (substring(sv."pathname" from '^/charts/([0-9a-fA-F-]{36})$'))::uuid
  );

DO $$ BEGIN
  ALTER TABLE "saved_views"
    ADD CONSTRAINT "saved_views_resource_id_fkey"
    FOREIGN KEY ("resource_id") REFERENCES "charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "saved_views"
  DROP CONSTRAINT IF EXISTS "saved_views_resource_kind_id_check";

ALTER TABLE "saved_views"
  ADD CONSTRAINT "saved_views_resource_kind_id_check"
  CHECK (
    ("resource_kind" = 'page' AND "resource_id" IS NULL)
    OR ("resource_kind" = 'chart' AND "resource_id" IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS "saved_views_owner_id_status_resource_kind_idx"
  ON "saved_views"("owner_id", "status", "resource_kind");

CREATE UNIQUE INDEX IF NOT EXISTS "saved_views_owner_chart_resource_active_key"
  ON "saved_views"("owner_id", "resource_id")
  WHERE "status" = 'active'
    AND "resource_kind" = 'chart'
    AND "resource_id" IS NOT NULL;
