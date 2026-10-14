-- Nested donut: one hierarchy rollup row per active work item (trigger-maintained).

CREATE INDEX IF NOT EXISTS "work_items_parent_id_idx" ON "work_items" ("parent_id");

CREATE TABLE IF NOT EXISTS "work_item_chart_hierarchy_rollups" (
    "work_item_id" UUID NOT NULL,
    "parent_id" UUID,
    "project_id" UUID NOT NULL,
    "sprint_id" UUID,
    "bucket_date" DATE NOT NULL,
    "status" "WorkItemStatus" NOT NULL,
    "status_category" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "state_id" TEXT NOT NULL,
    "type" "WorkItemType" NOT NULL,
    "priority" "WorkItemPriority" NOT NULL,
    "assignee_id" UUID,
    "item_count" INTEGER NOT NULL DEFAULT 1,
    "story_points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_item_chart_hierarchy_rollups_pkey" PRIMARY KEY ("work_item_id")
);

CREATE INDEX IF NOT EXISTS "work_item_chart_hierarchy_rollups_project_id_bucket_date_idx"
  ON "work_item_chart_hierarchy_rollups" ("project_id", "bucket_date");
CREATE INDEX IF NOT EXISTS "work_item_chart_hierarchy_rollups_project_id_parent_id_idx"
  ON "work_item_chart_hierarchy_rollups" ("project_id", "parent_id");
CREATE INDEX IF NOT EXISTS "work_item_chart_hierarchy_rollups_project_id_sprint_id_idx"
  ON "work_item_chart_hierarchy_rollups" ("project_id", "sprint_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_item_chart_hierarchy_rollups_work_item_id_fkey'
  ) THEN
    ALTER TABLE "work_item_chart_hierarchy_rollups"
      ADD CONSTRAINT "work_item_chart_hierarchy_rollups_work_item_id_fkey"
      FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_item_chart_hierarchy_rollups_project_id_fkey'
  ) THEN
    ALTER TABLE "work_item_chart_hierarchy_rollups"
      ADD CONSTRAINT "work_item_chart_hierarchy_rollups_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_item_chart_hierarchy_rollups_sprint_id_fkey'
  ) THEN
    ALTER TABLE "work_item_chart_hierarchy_rollups"
      ADD CONSTRAINT "work_item_chart_hierarchy_rollups_sprint_id_fkey"
      FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_item_chart_hierarchy_rollups_assignee_id_fkey'
  ) THEN
    ALTER TABLE "work_item_chart_hierarchy_rollups"
      ADD CONSTRAINT "work_item_chart_hierarchy_rollups_assignee_id_fkey"
      FOREIGN KEY ("assignee_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.work_item_chart_hierarchy_rollup_upsert(
  p_work_item_id uuid,
  p_parent_id uuid,
  p_project_id uuid,
  p_sprint_id uuid,
  p_bucket_date date,
  p_status "WorkItemStatus",
  p_status_category text,
  p_workflow_id text,
  p_state_id text,
  p_type "WorkItemType",
  p_priority "WorkItemPriority",
  p_assignee_id uuid,
  p_story_points integer
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  INSERT INTO public.work_item_chart_hierarchy_rollups AS r (
    work_item_id,
    parent_id,
    project_id,
    sprint_id,
    bucket_date,
    status,
    status_category,
    workflow_id,
    state_id,
    type,
    priority,
    assignee_id,
    item_count,
    story_points
  )
  VALUES (
    p_work_item_id,
    p_parent_id,
    p_project_id,
    p_sprint_id,
    p_bucket_date,
    p_status,
    p_status_category,
    p_workflow_id,
    p_state_id,
    p_type,
    p_priority,
    p_assignee_id,
    1,
    coalesce(p_story_points, 0)
  )
  ON CONFLICT (work_item_id) DO UPDATE
  SET
    parent_id = EXCLUDED.parent_id,
    project_id = EXCLUDED.project_id,
    sprint_id = EXCLUDED.sprint_id,
    bucket_date = EXCLUDED.bucket_date,
    status = EXCLUDED.status,
    status_category = EXCLUDED.status_category,
    workflow_id = EXCLUDED.workflow_id,
    state_id = EXCLUDED.state_id,
    type = EXCLUDED.type,
    priority = EXCLUDED.priority,
    assignee_id = EXCLUDED.assignee_id,
    item_count = 1,
    story_points = EXCLUDED.story_points;
END;
$$;

CREATE OR REPLACE FUNCTION public.work_item_chart_hierarchy_rollups_on_work_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.work_item_chart_hierarchy_rollups
    WHERE work_item_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.record_status = 'active'::"RecordStatus" THEN
    PERFORM public.work_item_chart_hierarchy_rollup_upsert(
      NEW.id,
      NEW.parent_id,
      NEW.project_id,
      NEW.sprint_id,
      (NEW.created_at AT TIME ZONE 'UTC')::date,
      NEW.status,
      NEW.status_category,
      NEW.state_workflow_id,
      NEW.state_id,
      NEW.type,
      NEW.priority,
      NEW.assignee_id,
      NEW.story_points
    );
  ELSE
    DELETE FROM public.work_item_chart_hierarchy_rollups
    WHERE work_item_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_item_chart_hierarchy_rollups_aiud ON public.work_items;
CREATE TRIGGER work_item_chart_hierarchy_rollups_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.work_items
  FOR EACH ROW
  EXECUTE FUNCTION public.work_item_chart_hierarchy_rollups_on_work_items();

-- Backfill from existing active work items
INSERT INTO public.work_item_chart_hierarchy_rollups (
  work_item_id,
  parent_id,
  project_id,
  sprint_id,
  bucket_date,
  status,
  status_category,
  workflow_id,
  state_id,
  type,
  priority,
  assignee_id,
  item_count,
  story_points
)
SELECT
  w.id,
  w.parent_id,
  w.project_id,
  w.sprint_id,
  (w.created_at AT TIME ZONE 'UTC')::date,
  w.status,
  w.status_category,
  w.state_workflow_id,
  w.state_id,
  w.type,
  w.priority,
  w.assignee_id,
  1,
  coalesce(w.story_points, 0)
FROM public.work_items w
WHERE w.record_status = 'active'::"RecordStatus"
ON CONFLICT (work_item_id) DO UPDATE
SET
  parent_id = EXCLUDED.parent_id,
  project_id = EXCLUDED.project_id,
  sprint_id = EXCLUDED.sprint_id,
  bucket_date = EXCLUDED.bucket_date,
  status = EXCLUDED.status,
  status_category = EXCLUDED.status_category,
  workflow_id = EXCLUDED.workflow_id,
  state_id = EXCLUDED.state_id,
  type = EXCLUDED.type,
  priority = EXCLUDED.priority,
  assignee_id = EXCLUDED.assignee_id,
  item_count = 1,
  story_points = EXCLUDED.story_points;

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
