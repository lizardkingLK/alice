-- Backlog workspace: one RPC for work items + active-tab sprints + team
-- capacities (projects/users stay on existing cached list readers).
-- SECURITY INVOKER — called from RSC via supabase.rpc.

CREATE OR REPLACE FUNCTION public.get_backlog_workspace_bundle(
  p_project_ids uuid[]
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_project_ids IS NULL OR cardinality(p_project_ids) = 0 THEN
      jsonb_build_object(
        'work_items', '[]'::jsonb,
        'sprints', '[]'::jsonb,
        'team_capacities', '[]'::jsonb
      )
    ELSE
      jsonb_build_object(
        'work_items',
        COALESCE(
          (
            SELECT jsonb_agg(row_to_json(wi)::jsonb ORDER BY wi.created_at DESC)
            FROM (
              SELECT
                id,
                project_id,
                sprint_id,
                parent_id,
                title,
                type,
                priority,
                labels,
                assignee_id,
                reporter_id,
                due_date,
                story_points,
                status,
                state,
                board_column_id,
                record_status,
                done_at,
                created_by,
                created_at,
                updated_by,
                updated_at,
                jira_issue_key
              FROM public.work_items
              WHERE record_status = 'active'
                AND project_id = ANY (p_project_ids)
            ) AS wi
          ),
          '[]'::jsonb
        ),
        'sprints',
        COALESCE(
          (
            SELECT jsonb_agg(sprint_row ORDER BY sprint_row.start_date DESC)
            FROM (
              SELECT
                jsonb_build_object(
                  'id', s.id,
                  'project_id', s.project_id,
                  'name', s.name,
                  'goal', s.goal,
                  'start_date', s.start_date,
                  'end_date', s.end_date,
                  'status', s.status,
                  'summary_report', s.summary_report,
                  'created_by', s.created_by,
                  'created_at', s.created_at,
                  'updated_by', s.updated_by,
                  'updated_at', s.updated_at,
                  'project',
                  CASE
                    WHEN p.id IS NULL THEN NULL
                    ELSE jsonb_build_object(
                      'id', p.id,
                      'key', p.key,
                      'name', p.name,
                      'status', p.status
                    )
                  END
                ) AS sprint_row,
                s.start_date
              FROM public.sprints s
              LEFT JOIN public.projects p ON p.id = s.project_id
              WHERE s.project_id = ANY (p_project_ids)
                AND s.status IN ('planned', 'active', 'closed')
            ) AS sprint_src
          ),
          '[]'::jsonb
        ),
        'team_capacities',
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'projectId', t.project_id,
                'userId', tm.user_id,
                'capacity', tm.capacity,
                'allocation', tm.allocation
              )
            )
            FROM public.teams t
            INNER JOIN public.team_members tm ON tm.team_id = t.id
            WHERE t.status = 'active'
              AND tm.status = 'active'
              AND t.project_id = ANY (p_project_ids)
          ),
          '[]'::jsonb
        )
      )
  END;
$$;

REVOKE ALL ON FUNCTION public.get_backlog_workspace_bundle(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_backlog_workspace_bundle(uuid[])
  TO postgres, anon, authenticated, service_role;
