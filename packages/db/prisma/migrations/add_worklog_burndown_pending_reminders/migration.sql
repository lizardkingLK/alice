-- Daily worklog burndown reminders: enum + single-query pending RPC.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'worklog_pending';

-- Per assignee × active sprint: estimated story points vs logged hours vs
-- linear ideal spend for p_as_of (same slope as computeBurndownIdeal).
-- Called by the API service role from the daily-reminders cron.
CREATE OR REPLACE FUNCTION public.get_worklog_burndown_pending(
  p_as_of date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  assignee_id uuid,
  sprint_id uuid,
  estimated_points numeric,
  logged_hours numeric,
  ideal_spent_eod numeric,
  pending_hours numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_sprint_items AS (
    SELECT
      wi.id AS work_item_id,
      wi.assignee_id,
      wi.sprint_id,
      s.start_date,
      s.end_date,
      COALESCE(wi.story_points, 0)::numeric AS story_points
    FROM public.work_items wi
    INNER JOIN public.sprints s ON s.id = wi.sprint_id
    WHERE s.status = 'active'
      AND s.start_date <= p_as_of
      AND s.end_date >= p_as_of
      AND wi.assignee_id IS NOT NULL
      AND wi.status <> 'Done'
      AND wi.record_status = 'active'
  ),
  estimates AS (
    SELECT
      asi.assignee_id,
      asi.sprint_id,
      asi.start_date,
      asi.end_date,
      SUM(asi.story_points) AS estimated_points
    FROM active_sprint_items asi
    GROUP BY asi.assignee_id, asi.sprint_id, asi.start_date, asi.end_date
  ),
  logs AS (
    SELECT
      asi.assignee_id,
      asi.sprint_id,
      COALESCE(SUM(wl.logged_hours), 0)::numeric AS logged_hours
    FROM active_sprint_items asi
    INNER JOIN public.work_item_worklogs wl
      ON wl.work_item_id = asi.work_item_id
     AND wl.status = 'active'
     AND (wl.logged_at AT TIME ZONE 'UTC')::date <= p_as_of
    GROUP BY asi.assignee_id, asi.sprint_id
  ),
  scored AS (
    SELECT
      e.assignee_id,
      e.sprint_id,
      e.estimated_points,
      COALESCE(l.logged_hours, 0)::numeric AS logged_hours,
      CASE
        WHEN (e.end_date - e.start_date) = 0 THEN e.estimated_points
        ELSE ROUND(
          e.estimated_points
            * (p_as_of - e.start_date)::numeric
            / (e.end_date - e.start_date)::numeric,
          2
        )
      END AS ideal_spent_eod
    FROM estimates e
    LEFT JOIN logs l
      ON l.assignee_id = e.assignee_id
     AND l.sprint_id = e.sprint_id
  )
  SELECT
    s.assignee_id,
    s.sprint_id,
    s.estimated_points,
    s.logged_hours,
    s.ideal_spent_eod,
    GREATEST(0, s.ideal_spent_eod - s.logged_hours) AS pending_hours
  FROM scored s
  WHERE GREATEST(0, s.ideal_spent_eod - s.logged_hours) > 0;
$$;

REVOKE ALL ON FUNCTION public.get_worklog_burndown_pending(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_worklog_burndown_pending(date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_worklog_burndown_pending(date) TO postgres, service_role;

-- Restore Supabase Data API access after Prisma DDL.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- Re-lock the cron RPC after the blanket EXECUTE grant above.
REVOKE ALL ON FUNCTION public.get_worklog_burndown_pending(date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_worklog_burndown_pending(date) TO postgres, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON ROUTINES TO anon, authenticated;
