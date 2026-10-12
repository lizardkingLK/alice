-- Charts burndown: trigger-maintained daily series (mirrors computeBurndown).

CREATE TABLE IF NOT EXISTS "sprint_burndown_rollups" (
    "sprint_id" UUID NOT NULL,
    "bucket_date" DATE NOT NULL,
    "project_id" UUID NOT NULL,
    "estimated_total" DOUBLE PRECISION NOT NULL,
    "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remaining" DOUBLE PRECISION,

    CONSTRAINT "sprint_burndown_rollups_pkey" PRIMARY KEY ("sprint_id", "bucket_date")
);

CREATE INDEX IF NOT EXISTS "sprint_burndown_rollups_project_id_sprint_id_idx"
  ON "sprint_burndown_rollups" ("project_id", "sprint_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sprint_burndown_rollups_sprint_id_fkey'
  ) THEN
    ALTER TABLE "sprint_burndown_rollups"
      ADD CONSTRAINT "sprint_burndown_rollups_sprint_id_fkey"
      FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sprint_burndown_rollups_project_id_fkey'
  ) THEN
    ALTER TABLE "sprint_burndown_rollups"
      ADD CONSTRAINT "sprint_burndown_rollups_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rebuild_sprint_burndown_rollups(p_sprint_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_id uuid;
  v_start date;
  v_end date;
  v_status text;
  v_estimated double precision;
  v_has_logs boolean;
  v_today date := (timezone('utc', now()))::date;
  v_day date;
  v_elapsed double precision;
  v_duration double precision;
  v_ideal double precision;
  v_spent double precision;
  v_remaining double precision;
  v_is_past boolean;
BEGIN
  SELECT s.project_id, s.start_date, s.end_date, s.status::text
  INTO v_project_id, v_start, v_end, v_status
  FROM public.sprints s
  WHERE s.id = p_sprint_id;

  IF v_project_id IS NULL THEN
    DELETE FROM public.sprint_burndown_rollups WHERE sprint_id = p_sprint_id;
    RETURN;
  END IF;

  DELETE FROM public.sprint_burndown_rollups WHERE sprint_id = p_sprint_id;

  IF v_end < v_start THEN
    RETURN;
  END IF;

  SELECT coalesce(sum(coalesce(wi.story_points, 0)), 0)::double precision
  INTO v_estimated
  FROM public.work_items wi
  WHERE wi.sprint_id = p_sprint_id
    AND wi.record_status = 'active';

  SELECT EXISTS (
    SELECT 1
    FROM public.work_item_worklogs wl
    INNER JOIN public.work_items wi ON wi.id = wl.work_item_id
    WHERE wi.sprint_id = p_sprint_id
      AND wi.record_status = 'active'
      AND wl.status = 'active'
  )
  INTO v_has_logs;

  v_duration := (v_end - v_start);

  v_day := v_start;
  WHILE v_day <= v_end LOOP
    v_elapsed := (v_day - v_start);
    IF v_duration = 0 THEN
      v_ideal := 0;
    ELSE
      v_ideal := greatest(0, v_estimated * (1 - (v_elapsed / v_duration)));
    END IF;
    v_ideal := round(v_ideal::numeric, 2)::double precision;

    v_is_past := (v_status = 'closed') OR (v_day <= v_today);
    v_spent := 0;
    v_remaining := NULL;

    IF v_is_past THEN
      IF v_has_logs THEN
        SELECT coalesce(sum(wl.logged_hours), 0)::double precision
        INTO v_spent
        FROM public.work_item_worklogs wl
        INNER JOIN public.work_items wi ON wi.id = wl.work_item_id
        WHERE wi.sprint_id = p_sprint_id
          AND wi.record_status = 'active'
          AND wl.status = 'active'
          AND (wl.logged_at AT TIME ZONE 'utc')::date <= v_day;

        v_remaining := greatest(0, v_estimated - v_spent);
      ELSE
        SELECT coalesce(sum(coalesce(wi.story_points, 0)), 0)::double precision
        INTO v_remaining
        FROM public.work_items wi
        WHERE wi.sprint_id = p_sprint_id
          AND wi.record_status = 'active'
          AND (
            wi.done_at IS NULL
            OR (wi.done_at AT TIME ZONE 'utc')::date > v_day
          );
        v_spent := greatest(0, v_estimated - coalesce(v_remaining, 0));
      END IF;
    END IF;

    INSERT INTO public.sprint_burndown_rollups (
      sprint_id,
      bucket_date,
      project_id,
      estimated_total,
      spent,
      remaining
    ) VALUES (
      p_sprint_id,
      v_day,
      v_project_id,
      v_estimated,
      coalesce(v_spent, 0),
      v_remaining
    );

    v_day := v_day + 1;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sprint_burndown_rollups_on_work_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.sprint_id IS NOT NULL THEN
      PERFORM public.rebuild_sprint_burndown_rollups(OLD.sprint_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.sprint_id IS DISTINCT FROM NEW.sprint_id THEN
      IF OLD.sprint_id IS NOT NULL THEN
        PERFORM public.rebuild_sprint_burndown_rollups(OLD.sprint_id);
      END IF;
      IF NEW.sprint_id IS NOT NULL THEN
        PERFORM public.rebuild_sprint_burndown_rollups(NEW.sprint_id);
      END IF;
    ELSIF NEW.sprint_id IS NOT NULL AND (
      OLD.story_points IS DISTINCT FROM NEW.story_points
      OR OLD.done_at IS DISTINCT FROM NEW.done_at
      OR OLD.record_status IS DISTINCT FROM NEW.record_status
    ) THEN
      PERFORM public.rebuild_sprint_burndown_rollups(NEW.sprint_id);
    END IF;
    RETURN NEW;
  END IF;

  -- INSERT
  IF NEW.sprint_id IS NOT NULL THEN
    PERFORM public.rebuild_sprint_burndown_rollups(NEW.sprint_id);
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
      PERFORM public.rebuild_sprint_burndown_rollups(v_sprint_id);
    END IF;
    RETURN OLD;
  END IF;

  SELECT wi.sprint_id INTO v_sprint_id
  FROM public.work_items wi
  WHERE wi.id = NEW.work_item_id;
  IF v_sprint_id IS NOT NULL THEN
    PERFORM public.rebuild_sprint_burndown_rollups(v_sprint_id);
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.work_item_id IS DISTINCT FROM NEW.work_item_id THEN
    SELECT wi.sprint_id INTO v_sprint_id
    FROM public.work_items wi
    WHERE wi.id = OLD.work_item_id;
    IF v_sprint_id IS NOT NULL THEN
      PERFORM public.rebuild_sprint_burndown_rollups(v_sprint_id);
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
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD.start_date IS DISTINCT FROM NEW.start_date
    OR OLD.end_date IS DISTINCT FROM NEW.end_date
    OR OLD.status IS DISTINCT FROM NEW.status
    OR OLD.project_id IS DISTINCT FROM NEW.project_id
  ) THEN
    PERFORM public.rebuild_sprint_burndown_rollups(NEW.id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.rebuild_sprint_burndown_rollups(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sprint_burndown_rollups_work_items_aiud ON public.work_items;
CREATE TRIGGER sprint_burndown_rollups_work_items_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.work_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sprint_burndown_rollups_on_work_items();

DROP TRIGGER IF EXISTS sprint_burndown_rollups_worklogs_aiud ON public.work_item_worklogs;
CREATE TRIGGER sprint_burndown_rollups_worklogs_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.work_item_worklogs
  FOR EACH ROW
  EXECUTE FUNCTION public.sprint_burndown_rollups_on_worklogs();

DROP TRIGGER IF EXISTS sprint_burndown_rollups_sprints_aiud ON public.sprints;
CREATE TRIGGER sprint_burndown_rollups_sprints_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.sprints
  FOR EACH ROW
  EXECUTE FUNCTION public.sprint_burndown_rollups_on_sprints();

-- Backfill planned / active / closed sprints
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.sprints
    WHERE status::text IN ('planned', 'active', 'closed')
  LOOP
    PERFORM public.rebuild_sprint_burndown_rollups(r.id);
  END LOOP;
END $$;
