-- Peer work-item links (relates_to). Canonical id order on write avoids A↔B dupes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'WorkItemLinkType'
  ) THEN
    CREATE TYPE "WorkItemLinkType" AS ENUM ('relates_to');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "work_item_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "source_id" UUID NOT NULL,
  "target_id" UUID NOT NULL,
  "link_type" "WorkItemLinkType" NOT NULL DEFAULT 'relates_to',
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "work_item_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_item_links_source_target_distinct"
    CHECK ("source_id" <> "target_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "work_item_links_source_id_target_id_link_type_key"
  ON "work_item_links"("source_id", "target_id", "link_type");

CREATE INDEX IF NOT EXISTS "work_item_links_project_id_idx"
  ON "work_item_links"("project_id");

CREATE INDEX IF NOT EXISTS "work_item_links_source_id_idx"
  ON "work_item_links"("source_id");

CREATE INDEX IF NOT EXISTS "work_item_links_target_id_idx"
  ON "work_item_links"("target_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_item_links_project_id_fkey'
  ) THEN
    ALTER TABLE "work_item_links"
      ADD CONSTRAINT "work_item_links_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_item_links_source_id_fkey'
  ) THEN
    ALTER TABLE "work_item_links"
      ADD CONSTRAINT "work_item_links_source_id_fkey"
      FOREIGN KEY ("source_id") REFERENCES "work_items"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_item_links_target_id_fkey'
  ) THEN
    ALTER TABLE "work_item_links"
      ADD CONSTRAINT "work_item_links_target_id_fkey"
      FOREIGN KEY ("target_id") REFERENCES "work_items"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_item_links_created_by_fkey'
  ) THEN
    ALTER TABLE "work_item_links"
      ADD CONSTRAINT "work_item_links_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
