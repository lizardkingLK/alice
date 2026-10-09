-- Work-item activity feed (append-only). See docs/features/work-items/ACTIVITY.md.

CREATE TYPE "ActivityAction" AS ENUM (
  'created',
  'field_changed',
  'attachment_added',
  'attachment_removed',
  'commented',
  'workflow_transition',
  'escalation_resolved'
);

CREATE TABLE "activities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "work_item_id" UUID NOT NULL,
  "actor_id" UUID,
  "action" "ActivityAction" NOT NULL,
  "field" TEXT,
  "old_value" TEXT,
  "new_value" TEXT,
  "meta" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activities_work_item_id_fkey"
    FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "activities_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "activities_work_item_id_created_at_idx"
  ON "activities" ("work_item_id", "created_at" DESC);

-- Supabase Data API grants (match other migrations in this repo)
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

-- RLS: authenticated may SELECT when the parent work item exists; writes via service_role only.
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated select activities"
  ON "activities"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "work_items" wi
      WHERE wi."id" = "activities"."work_item_id"
    )
  );

CREATE POLICY "Allow service_role all activities"
  ON "activities"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
