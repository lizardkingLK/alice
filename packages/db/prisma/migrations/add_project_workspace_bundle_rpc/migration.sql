-- Project details workspace: one RPC for project + members + tab badge counts.
-- SECURITY INVOKER — called from RSC via supabase.rpc after ACL gate.
-- Omits integration secrets (github_token never selected).

CREATE OR REPLACE FUNCTION public.get_project_workspace_bundle(
  p_project_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_project_id IS NULL THEN NULL
    WHEN NOT EXISTS (
      SELECT 1 FROM public.projects pr WHERE pr.id = p_project_id
    ) THEN NULL
    ELSE
      jsonb_build_object(
        'project',
        (
          SELECT jsonb_build_object(
            'id', p.id,
            'key', p.key,
            'name', p.name,
            'description', p.description,
            'status', p.status,
            'owner_id', p.owner_id,
            'start_date', p.start_date,
            'end_date', p.end_date,
            'jira_connection_id', p.jira_connection_id,
            'jira_project_key', p.jira_project_key,
            'github_repo', p.github_repo,
            'logo_url', p.logo_url,
            'cover_picture', p.cover_picture,
            'attributes_config', p.attributes_config,
            'workflow_config', p.workflow_config,
            'created_by', p.created_by,
            'created_at', p.created_at,
            'updated_by', p.updated_by,
            'updated_at', p.updated_at,
            'deleted_at', p.deleted_at,
            'has_github_token', (p.github_token IS NOT NULL AND length(p.github_token) > 0),
            'owner',
            CASE
              WHEN u.id IS NULL THEN NULL
              ELSE jsonb_build_object(
                'id', u.id,
                'name', u.name,
                'email', u.email,
                'profile_picture', u.profile_picture
              )
            END
          )
          FROM public.projects p
          LEFT JOIN public.users u ON u.id = p.owner_id
          WHERE p.id = p_project_id
        ),
        'members',
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'project_id', pm.project_id,
                'user_id', pm.user_id,
                'status', pm.status,
                'created_at', pm.created_at,
                'user',
                CASE
                  WHEN mu.id IS NULL THEN NULL
                  ELSE jsonb_build_object(
                    'id', mu.id,
                    'name', mu.name,
                    'email', mu.email,
                    'role', mu.role,
                    'profile_picture', mu.profile_picture
                  )
                END
              )
              ORDER BY mu.name NULLS LAST
            )
            FROM public.project_members pm
            LEFT JOIN public.users mu ON mu.id = pm.user_id
            WHERE pm.project_id = p_project_id
              AND pm.status = 'active'
          ),
          '[]'::jsonb
        ),
        'work_item_total',
        (
          SELECT count(*)::int
          FROM public.work_items wi
          WHERE wi.project_id = p_project_id
            AND wi.record_status = 'active'
        ),
        'team_total',
        (
          SELECT count(*)::int
          FROM public.teams t
          WHERE t.project_id = p_project_id
            AND t.status <> 'deleted'
        ),
        'sprint_total',
        (
          SELECT count(*)::int
          FROM public.sprints s
          WHERE s.project_id = p_project_id
            AND s.status IN ('planned', 'active', 'closed')
        )
      )
  END;
$$;

REVOKE ALL ON FUNCTION public.get_project_workspace_bundle(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_workspace_bundle(uuid)
  TO postgres, anon, authenticated, service_role;
