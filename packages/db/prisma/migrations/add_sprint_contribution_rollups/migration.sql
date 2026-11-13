-- Charts sprint contribution: trigger-maintained per-assignee snapshot.
-- Rebuilds share the burndown write path via rebuild_sprint_analytics_rollups.

CREATE TABLE IF NOT EXISTS "sprint_contribution_rollups" (
    "sprint_id" UUID NOT NULL,
    "assignee_key" TEXT NOT NULL,
    "assignee_id" UUID,
    "project_id" UUID NOT NULL,
    "as_of" DATE NOT NULL,
    "group_id" TEXT NOT NULL,
    "estimated_points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "logged_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "item_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sprint_contribution_rollups_pkey"
      PRIMARY KEY ("sprint_id", "assignee_key"),
    CONSTRAINT "sprint_contribution_rollups_group_id_check"
      CHECK ("group_id" IN ('active', 'unassigned', 'done'))
);

CREATE INDEX IF NOT EXISTS "sprint_contribution_rollups_project_id_sprint_id_idx"
  ON "sprint_contribution_rollups" ("project_id", "sprint_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sprint_contribution_rollups_sprint_id_fkey'
  ) THEN
    ALTER TABLE "sprint_contribution_rollups"
      ADD CONSTRAINT "sprint_contribution_rollups_sprint_id_fkey"
      FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sprint_contribution_rollups_project_id_fkey'
  ) THEN
    ALTER TABLE "sprint_contribution_rollups"
      ADD CONSTRAINT "sprint_contribution_rollups_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sprint_contribution_rollups_assignee_id_fkey'
  ) THEN
    ALTER TABLE "sprint_contribution_rollups"
      ADD CONSTRAINT "sprint_contribution_rollups_assignee_id_fkey"
      FOREIGN KEY ("assignee_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rebuild_sprint_contribution_rollups(p_sprint_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_id uuid;
  v_start date;
  v_end date;
  v_today date := (timezone('utc', now()))::date;
  v_as_of date;
BEGIN
  SELECT s.project_id, s.start_date, s.end_date
  INTO v_project_id, v_start, v_end
  FROM public.sprints s
  WHERE s.id = p_sprint_id;

  IF v_project_id IS NULL THEN
    DELETE FROM public.sprint_contribution_rollups WHERE sprint_id = p_sprint_id;
    RETURN;
  END IF;

  DELETE FROM public.sprint_contribution_rollups WHERE sprint_id = p_sprint_id;

  IF v_end < v_start THEN
    RETURN;
  END IF;

  -- Clamp today into [start, end] (matches clampContributionAsOf).
  IF v_today < v_start THEN
    v_as_of := v_start;
  ELSIF v_today > v_end THEN
    v_as_of := v_end;
  ELSE
    v_as_of := v_today;
  END IF;

  INSERT INTO public.sprint_contribution_rollups (
    sprint_id,
    assignee_key,
    assignee_id,
    project_id,
    as_of,
    group_id,
    estimated_points,
    logged_hours,
    item_count
  )
  SELECT
    p_sprint_id,
    coalesce(agg.assignee_id::text, ''),
    agg.assignee_id,
    v_project_id,
    v_as_of,
    CASE
      WHEN agg.assignee_id IS NULL THEN 'unassigned'
      WHEN agg.has_open THEN 'active'
      ELSE 'done'
    END,
    round(agg.estimated_points::numeric, 2)::double precision,
    round(coalesce(logs.logged_hours, 0)::numeric, 2)::double precision,
    agg.item_count
  FROM (
    SELECT
      wi.assignee_id,
      coalesce(sum(coalesce(wi.story_points, 0)), 0)::double precision
        AS estimated_points,
      count(*)::integer AS item_count,
      bool_or(wi.status_category IS DISTINCT FROM 'done') AS has_open
    FROM public.work_items wi
    WHERE wi.sprint_id = p_sprint_id
      AND wi.record_status = 'active'
    GROUP BY wi.assignee_id
  ) agg
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(wl.logged_hours), 0)::double precision AS logged_hours
    FROM public.work_items wi
    INNER JOIN public.work_item_worklogs wl ON wl.work_item_id = wi.id
    WHERE wi.sprint_id = p_sprint_id
      AND wi.record_status = 'active'
      AND wl.status = 'active'
      AND (wl.logged_at AT TIME ZONE 'utc')::date <= v_as_of
      AND (
        (agg.assignee_id IS NULL AND wi.assignee_id IS NULL)
        OR wi.assignee_id = agg.assignee_id
      )
  ) logs ON true;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_sprint_analytics_rollups(p_sprint_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.rebuild_sprint_burndown_rollups(p_sprint_id);
  PERFORM public.rebuild_sprint_contribution_rollups(p_sprint_id);
END;
$$;

-- Retarget burndown triggers to the shared analytics wrapper; watch assignee /
-- status_category for contribution grouping.
CREATE OR REPLACE FUNCTION public.sprint_burndown_rollups_on_work_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.sprint_id IS NOT NULL THEN
      PERFORM public.rebuild_sprint_analytics_rollups(OLD.sprint_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.sprint_id IS DISTINCT FROM NEW.sprint_id THEN
      IF OLD.sprint_id IS NOT NULL THEN
        PERFORM public.rebuild_sprint_analytics_rollups(OLD.sprint_id);
      END IF;
      IF NEW.sprint_id IS NOT NULL THEN
        PERFORM public.rebuild_sprint_analytics_rollups(NEW.sprint_id);
      END IF;
    ELSIF NEW.sprint_id IS NOT NULL AND (
      OLD.story_points IS DISTINCT FROM NEW.story_points
      OR OLD.done_at IS DISTINCT FROM NEW.done_at
      OR OLD.record_status IS DISTINCT FROM NEW.record_status
      OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id
      OR OLD.status_category IS DISTINCT FROM NEW.status_category
    ) THEN
      PERFORM public.rebuild_sprint_analytics_rollups(NEW.sprint_id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.sprint_id IS NOT NULL THEN
    PERFORM public.rebuild_sprint_analytics_rollups(NEW.sprint_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sprint_burndown_rollups_on_worklogs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_sprint_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT wi.sprint_id INTO v_sprint_id
    FROM public.work_items wi
    WHERE wi.id = OLD.work_item_id;
    IF v_sprint_id IS NOT NULL THEN
      PERFORM public.rebuild_sprint_analytics_rollups(v_sprint_id);
    END IF;
    RETURN OLD;
  END IF;

  SELECT wi.sprint_id INTO v_sprint_id
  FROM public.work_items wi
  WHERE wi.id = NEW.work_item_id;
  IF v_sprint_id IS NOT NULL THEN
    PERFORM public.rebuild_sprint_analytics_rollups(v_sprint_id);
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.work_item_id IS DISTINCT FROM NEW.work_item_id THEN
    SELECT wi.sprint_id INTO v_sprint_id
    FROM public.work_items wi
    WHERE wi.id = OLD.work_item_id;
    IF v_sprint_id IS NOT NULL THEN
      PERFORM public.rebuild_sprint_analytics_rollups(v_sprint_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sprint_burndown_rollups_on_sprints()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.sprint_burndown_rollups WHERE sprint_id = OLD.id;
    DELETE FROM public.sprint_contribution_rollups WHERE sprint_id = OLD.id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD.start_date IS DISTINCT FROM NEW.start_date
    OR OLD.end_date IS DISTINCT FROM NEW.end_date
    OR OLD.status IS DISTINCT FROM NEW.status
    OR OLD.project_id IS DISTINCT FROM NEW.project_id
  ) THEN
    PERFORM public.rebuild_sprint_analytics_rollups(NEW.id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.rebuild_sprint_analytics_rollups(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.sprint_contribution_rollups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sprint_contribution_rollups FROM anon, authenticated;

-- Backfill planned / active / closed sprints (contribution only; burndown already filled).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.sprints
    WHERE status::text IN ('planned', 'active', 'closed')
  LOOP
    PERFORM public.rebuild_sprint_contribution_rollups(r.id);
  END LOOP;
END $$;
