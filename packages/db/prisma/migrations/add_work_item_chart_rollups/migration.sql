-- Chart Tier 1: dimension indexes on work_items + trigger-maintained rollups.

-- Indexes for chart filters / slice drilldown
CREATE INDEX IF NOT EXISTS "work_items_assignee_id_idx" ON "work_items" ("assignee_id");
CREATE INDEX IF NOT EXISTS "work_items_sprint_id_idx" ON "work_items" ("sprint_id");
CREATE INDEX IF NOT EXISTS "work_items_project_id_status_idx" ON "work_items" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "work_items_created_at_idx" ON "work_items" ("created_at");

-- Rollup table (grain_key avoids NULL uniqueness issues for sprint/assignee)
CREATE TABLE "work_item_chart_rollups" (
    "grain_key" TEXT NOT NULL,
    "bucket_date" DATE NOT NULL,
    "project_id" UUID NOT NULL,
    "sprint_id" UUID,
    "status" "WorkItemStatus" NOT NULL,
    "type" "WorkItemType" NOT NULL,
    "priority" "WorkItemPriority" NOT NULL,
    "assignee_id" UUID,
    "item_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_item_chart_rollups_pkey" PRIMARY KEY ("grain_key")
);

CREATE INDEX "work_item_chart_rollups_project_id_bucket_date_idx"
  ON "work_item_chart_rollups" ("project_id", "bucket_date");

ALTER TABLE "work_item_chart_rollups"
  ADD CONSTRAINT "work_item_chart_rollups_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_item_chart_rollups"
  ADD CONSTRAINT "work_item_chart_rollups_sprint_id_fkey"
  FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_item_chart_rollups"
  ADD CONSTRAINT "work_item_chart_rollups_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Helpers + trigger: maintain item_count per grain for active work items only
CREATE OR REPLACE FUNCTION public.work_item_chart_rollup_grain_key(
  p_bucket_date date,
  p_project_id uuid,
  p_sprint_id uuid,
  p_status "WorkItemStatus",
  p_type "WorkItemType",
  p_priority "WorkItemPriority",
  p_assignee_id uuid
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT concat_ws(
    '|',
    p_bucket_date::text,
    p_project_id::text,
    coalesce(p_sprint_id::text, ''),
    p_status::text,
    p_type::text,
    p_priority::text,
    coalesce(p_assignee_id::text, '')
  );
$$;

CREATE OR REPLACE FUNCTION public.work_item_chart_rollup_apply_delta(
  p_bucket_date date,
  p_project_id uuid,
  p_sprint_id uuid,
  p_status "WorkItemStatus",
  p_type "WorkItemType",
  p_priority "WorkItemPriority",
  p_assignee_id uuid,
  p_delta integer
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_key text;
BEGIN
  IF p_delta = 0 THEN
    RETURN;
  END IF;

  v_key := public.work_item_chart_rollup_grain_key(
    p_bucket_date,
    p_project_id,
    p_sprint_id,
    p_status,
    p_type,
    p_priority,
    p_assignee_id
  );

  INSERT INTO public.work_item_chart_rollups AS r (
    grain_key,
    bucket_date,
    project_id,
    sprint_id,
    status,
    type,
    priority,
    assignee_id,
    item_count
  )
  VALUES (
    v_key,
    p_bucket_date,
    p_project_id,
    p_sprint_id,
    p_status,
    p_type,
    p_priority,
    p_assignee_id,
    p_delta
  )
  ON CONFLICT (grain_key) DO UPDATE
  SET item_count = r.item_count + EXCLUDED.item_count;

  DELETE FROM public.work_item_chart_rollups
  WHERE grain_key = v_key
    AND item_count <= 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.work_item_chart_rollups_on_work_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_old_active boolean;
  v_new_active boolean;
  v_old_bucket date;
  v_new_bucket date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.record_status = 'active'::"RecordStatus" THEN
      PERFORM public.work_item_chart_rollup_apply_delta(
        (OLD.created_at AT TIME ZONE 'UTC')::date,
        OLD.project_id,
        OLD.sprint_id,
        OLD.status,
        OLD.type,
        OLD.priority,
        OLD.assignee_id,
        -1
      );
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.record_status = 'active'::"RecordStatus" THEN
      PERFORM public.work_item_chart_rollup_apply_delta(
        (NEW.created_at AT TIME ZONE 'UTC')::date,
        NEW.project_id,
        NEW.sprint_id,
        NEW.status,
        NEW.type,
        NEW.priority,
        NEW.assignee_id,
        1
      );
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  v_old_active := OLD.record_status = 'active'::"RecordStatus";
  v_new_active := NEW.record_status = 'active'::"RecordStatus";
  v_old_bucket := (OLD.created_at AT TIME ZONE 'UTC')::date;
  v_new_bucket := (NEW.created_at AT TIME ZONE 'UTC')::date;

  IF v_old_active
    AND v_new_active
    AND v_old_bucket = v_new_bucket
    AND OLD.project_id IS NOT DISTINCT FROM NEW.project_id
    AND OLD.sprint_id IS NOT DISTINCT FROM NEW.sprint_id
    AND OLD.status IS NOT DISTINCT FROM NEW.status
    AND OLD.type IS NOT DISTINCT FROM NEW.type
    AND OLD.priority IS NOT DISTINCT FROM NEW.priority
    AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id
  THEN
    RETURN NEW;
  END IF;

  IF v_old_active THEN
    PERFORM public.work_item_chart_rollup_apply_delta(
      v_old_bucket,
      OLD.project_id,
      OLD.sprint_id,
      OLD.status,
      OLD.type,
      OLD.priority,
      OLD.assignee_id,
      -1
    );
  END IF;

  IF v_new_active THEN
    PERFORM public.work_item_chart_rollup_apply_delta(
      v_new_bucket,
      NEW.project_id,
      NEW.sprint_id,
      NEW.status,
      NEW.type,
      NEW.priority,
      NEW.assignee_id,
      1
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_item_chart_rollups_aiud ON public.work_items;
CREATE TRIGGER work_item_chart_rollups_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.work_items
  FOR EACH ROW
  EXECUTE FUNCTION public.work_item_chart_rollups_on_work_items();

-- Backfill from existing active work items
INSERT INTO public.work_item_chart_rollups (
  grain_key,
  bucket_date,
  project_id,
  sprint_id,
  status,
  type,
  priority,
  assignee_id,
  item_count
)
SELECT
  public.work_item_chart_rollup_grain_key(
    (w.created_at AT TIME ZONE 'UTC')::date,
    w.project_id,
    w.sprint_id,
    w.status,
    w.type,
    w.priority,
    w.assignee_id
  ),
  (w.created_at AT TIME ZONE 'UTC')::date,
  w.project_id,
  w.sprint_id,
  w.status,
  w.type,
  w.priority,
  w.assignee_id,
  count(*)::integer
FROM public.work_items w
WHERE w.record_status = 'active'::"RecordStatus"
GROUP BY
  (w.created_at AT TIME ZONE 'UTC')::date,
  w.project_id,
  w.sprint_id,
  w.status,
  w.type,
  w.priority,
  w.assignee_id
ON CONFLICT (grain_key) DO UPDATE
SET item_count = EXCLUDED.item_count;

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
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON ALL ROUTINES TO anon, authenticated;
