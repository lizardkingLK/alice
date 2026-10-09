-- Step 7: chart rollups + work_items placement mirrors for category / state.

-- ---------------------------------------------------------------------------
-- Resolve placement (mirrors @repo/types resolveWorkItemState)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.work_item_chart_category_from_status(
  p_status "WorkItemStatus"
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'Draft'::"WorkItemStatus" THEN 'draft'
    WHEN 'New'::"WorkItemStatus" THEN 'todo'
    WHEN 'ToDo'::"WorkItemStatus" THEN 'todo'
    WHEN 'InProgress'::"WorkItemStatus" THEN 'in_progress'
    WHEN 'Testing'::"WorkItemStatus" THEN 'in_progress'
    WHEN 'Done'::"WorkItemStatus" THEN 'done'
    ELSE 'todo'
  END;
$$;

CREATE OR REPLACE FUNCTION public.work_item_chart_resolve_placement(
  p_state jsonb,
  p_status "WorkItemStatus",
  p_board_column_id text
) RETURNS TABLE (
  workflow_id text,
  state_id text,
  status_category text
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_workflow text;
  v_state text;
  v_category text;
BEGIN
  IF p_state IS NOT NULL
    AND jsonb_typeof(p_state) = 'object'
    AND nullif(btrim(p_state->>'workflowId'), '') IS NOT NULL
    AND nullif(btrim(p_state->>'stateId'), '') IS NOT NULL
    AND nullif(btrim(p_state->>'category'), '') IS NOT NULL
    AND (p_state->>'category') IN ('draft', 'todo', 'in_progress', 'done')
  THEN
    workflow_id := btrim(p_state->>'workflowId');
    state_id := btrim(p_state->>'stateId');
    status_category := btrim(p_state->>'category');
    RETURN NEXT;
    RETURN;
  END IF;

  workflow_id := 'wf-default';
  state_id := coalesce(nullif(btrim(p_board_column_id), ''), p_status::text);
  status_category := public.work_item_chart_category_from_status(p_status);
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- work_items placement columns
-- ---------------------------------------------------------------------------
ALTER TABLE "work_items"
  ADD COLUMN IF NOT EXISTS "status_category" TEXT,
  ADD COLUMN IF NOT EXISTS "state_id" TEXT,
  ADD COLUMN IF NOT EXISTS "state_workflow_id" TEXT;

UPDATE "work_items" AS w
SET
  status_category = p.status_category,
  state_id = p.state_id,
  state_workflow_id = p.workflow_id
FROM (
  SELECT
    wi.id,
    r.workflow_id,
    r.state_id,
    r.status_category
  FROM public.work_items wi
  CROSS JOIN LATERAL public.work_item_chart_resolve_placement(
    wi.state,
    wi.status,
    wi.board_column_id
  ) AS r
) AS p
WHERE w.id = p.id
  AND (
    w.status_category IS NULL
    OR w.state_id IS NULL
    OR w.state_workflow_id IS NULL
  );

ALTER TABLE "work_items"
  ALTER COLUMN "status_category" SET DEFAULT 'todo',
  ALTER COLUMN "state_id" SET DEFAULT 'New',
  ALTER COLUMN "state_workflow_id" SET DEFAULT 'wf-default';

ALTER TABLE "work_items"
  ALTER COLUMN "status_category" SET NOT NULL,
  ALTER COLUMN "state_id" SET NOT NULL,
  ALTER COLUMN "state_workflow_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "work_items_project_id_status_category_idx"
  ON "work_items" ("project_id", "status_category");
CREATE INDEX IF NOT EXISTS "work_items_project_id_state_id_idx"
  ON "work_items" ("project_id", "state_id");

-- Keep mirrors in sync before rollup AFTER trigger runs.
CREATE OR REPLACE FUNCTION public.work_items_sync_placement_biu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_placement record;
BEGIN
  SELECT * INTO v_placement
  FROM public.work_item_chart_resolve_placement(
    NEW.state,
    NEW.status,
    NEW.board_column_id
  );
  NEW.status_category := v_placement.status_category;
  NEW.state_id := v_placement.state_id;
  NEW.state_workflow_id := v_placement.workflow_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_items_sync_placement_biu ON public.work_items;
CREATE TRIGGER work_items_sync_placement_biu
  BEFORE INSERT OR UPDATE OF state, status, board_column_id
  ON public.work_items
  FOR EACH ROW
  EXECUTE FUNCTION public.work_items_sync_placement_biu();

-- ---------------------------------------------------------------------------
-- Rollup grain columns
-- ---------------------------------------------------------------------------
ALTER TABLE "work_item_chart_rollups"
  ADD COLUMN IF NOT EXISTS "status_category" TEXT,
  ADD COLUMN IF NOT EXISTS "workflow_id" TEXT,
  ADD COLUMN IF NOT EXISTS "state_id" TEXT;

-- Drop prior overloads (CREATE OR REPLACE does not replace changed arg lists).
DROP FUNCTION IF EXISTS public.work_item_chart_rollup_grain_key(
  date, uuid, uuid, "WorkItemStatus", "WorkItemType", "WorkItemPriority", uuid
);
DROP FUNCTION IF EXISTS public.work_item_chart_rollup_apply_delta(
  date, uuid, uuid, "WorkItemStatus", "WorkItemType", "WorkItemPriority", uuid, integer
);

CREATE OR REPLACE FUNCTION public.work_item_chart_rollup_grain_key(
  p_bucket_date date,
  p_project_id uuid,
  p_sprint_id uuid,
  p_status "WorkItemStatus",
  p_status_category text,
  p_workflow_id text,
  p_state_id text,
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
    p_status_category,
    p_workflow_id,
    p_state_id,
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
  p_status_category text,
  p_workflow_id text,
  p_state_id text,
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
    p_status_category,
    p_workflow_id,
    p_state_id,
    p_type,
    p_priority,
    p_assignee_id
  );

  IF p_delta < 0 THEN
    UPDATE public.work_item_chart_rollups AS r
    SET item_count = r.item_count + p_delta
    WHERE r.grain_key = v_key;

    DELETE FROM public.work_item_chart_rollups
    WHERE grain_key = v_key
      AND item_count <= 0;

    RETURN;
  END IF;

  INSERT INTO public.work_item_chart_rollups AS r (
    grain_key,
    bucket_date,
    project_id,
    sprint_id,
    status,
    status_category,
    workflow_id,
    state_id,
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
    p_status_category,
    p_workflow_id,
    p_state_id,
    p_type,
    p_priority,
    p_assignee_id,
    p_delta
  )
  ON CONFLICT (grain_key) DO UPDATE
  SET item_count = r.item_count + EXCLUDED.item_count;
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
        OLD.status_category,
        OLD.state_workflow_id,
        OLD.state_id,
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
        NEW.status_category,
        NEW.state_workflow_id,
        NEW.state_id,
        NEW.type,
        NEW.priority,
        NEW.assignee_id,
        1
      );
    END IF;
    RETURN NEW;
  END IF;

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
    AND OLD.status_category IS NOT DISTINCT FROM NEW.status_category
    AND OLD.state_workflow_id IS NOT DISTINCT FROM NEW.state_workflow_id
    AND OLD.state_id IS NOT DISTINCT FROM NEW.state_id
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
      OLD.status_category,
      OLD.state_workflow_id,
      OLD.state_id,
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
      NEW.status_category,
      NEW.state_workflow_id,
      NEW.state_id,
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

-- Rebuild rollups under the new grain (old grain_key shape is obsolete).
TRUNCATE TABLE public.work_item_chart_rollups;

ALTER TABLE "work_item_chart_rollups"
  ALTER COLUMN "status_category" SET NOT NULL,
  ALTER COLUMN "workflow_id" SET NOT NULL,
  ALTER COLUMN "state_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "work_item_chart_rollups_project_id_status_category_idx"
  ON "work_item_chart_rollups" ("project_id", "status_category");
CREATE INDEX IF NOT EXISTS "work_item_chart_rollups_project_id_state_id_idx"
  ON "work_item_chart_rollups" ("project_id", "state_id");

INSERT INTO public.work_item_chart_rollups (
  grain_key,
  bucket_date,
  project_id,
  sprint_id,
  status,
  status_category,
  workflow_id,
  state_id,
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
    w.status_category,
    w.state_workflow_id,
    w.state_id,
    w.type,
    w.priority,
    w.assignee_id
  ),
  (w.created_at AT TIME ZONE 'UTC')::date,
  w.project_id,
  w.sprint_id,
  w.status,
  w.status_category,
  w.state_workflow_id,
  w.state_id,
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
  w.status_category,
  w.state_workflow_id,
  w.state_id,
  w.type,
  w.priority,
  w.assignee_id
ON CONFLICT (grain_key) DO UPDATE
SET item_count = EXCLUDED.item_count;

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
