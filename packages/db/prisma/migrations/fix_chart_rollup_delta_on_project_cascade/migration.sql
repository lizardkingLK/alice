-- Project hard-delete cascades to work_items. AFTER DELETE on work_items called
-- work_item_chart_rollup_apply_delta(-1), which INSERT…ON CONFLICT'd a rollup
-- row with the dying project_id → FK work_item_chart_rollups_project_id_fkey.
-- Negative deltas must only touch existing rollup rows (never insert).

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

  -- Decrements (work-item delete / dimension leave): update only. Inserting a
  -- new grain during project CASCADE re-creates rows that reference a project
  -- mid-delete and violates work_item_chart_rollups_project_id_fkey.
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
END;
$$;
