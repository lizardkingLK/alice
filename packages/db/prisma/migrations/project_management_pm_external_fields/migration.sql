-- Generalize remaining Jira columns on projects / work_items.
-- - projects.jira_connection_id → pm_connection_id (typed FK)
-- - projects.jira_project_key → pm_external jsonb { vendor, project_key }
-- - work_items.jira_issue_key → pm_external jsonb { vendor, issue_key }
-- RPC JSON still exposes jira_* keys for existing web/API adapters.

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "pm_connection_id" UUID;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "pm_external" JSONB;

UPDATE "projects"
SET
  "pm_connection_id" = "jira_connection_id",
  "pm_external" = CASE
    WHEN "jira_project_key" IS NULL OR btrim("jira_project_key") = '' THEN NULL
    ELSE jsonb_build_object(
      'vendor', 'jira',
      'project_key', "jira_project_key"
    )
  END
WHERE "jira_connection_id" IS NOT NULL
   OR ("jira_project_key" IS NOT NULL AND btrim("jira_project_key") <> '');

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_jira_connection_id_fkey";

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_pm_connection_id_fkey"
  FOREIGN KEY ("pm_connection_id")
  REFERENCES "project_management_connections"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "projects" DROP COLUMN IF EXISTS "jira_connection_id";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "jira_project_key";

-- ---------------------------------------------------------------------------
-- work_items
-- ---------------------------------------------------------------------------

ALTER TABLE "work_items" ADD COLUMN IF NOT EXISTS "pm_external" JSONB;

UPDATE "work_items"
SET "pm_external" = jsonb_build_object(
  'vendor', 'jira',
  'issue_key', "jira_issue_key"
)
WHERE "jira_issue_key" IS NOT NULL AND btrim("jira_issue_key") <> '';

DROP INDEX IF EXISTS "work_items_project_id_jira_issue_key_key";

CREATE UNIQUE INDEX "work_items_project_id_pm_jira_issue_key_key"
  ON "work_items" ("project_id", ((pm_external ->> 'issue_key')))
  WHERE pm_external IS NOT NULL
    AND pm_external ->> 'vendor' = 'jira'
    AND pm_external ->> 'issue_key' IS NOT NULL
    AND btrim(pm_external ->> 'issue_key') <> '';

ALTER TABLE "work_items" DROP COLUMN IF EXISTS "jira_issue_key";

-- ---------------------------------------------------------------------------
-- RPCs: keep jira_* keys in JSON for adapters
-- ---------------------------------------------------------------------------

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
            'jira_connection_id', p.pm_connection_id,
            'jira_project_key', p.pm_external ->> 'project_key',
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
                (pm_external ->> 'issue_key') AS jira_issue_key
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
            SELECT jsonb_agg(sprint_src.sprint_row ORDER BY sprint_src.start_date DESC)
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

REVOKE ALL ON TABLE public.integrations FROM anon, authenticated;
REVOKE ALL ON TABLE public.project_management_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.chat_attachments FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_allowlist FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_requests FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_project_workspace_bundle(uuid)
  TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_backlog_workspace_bundle(uuid[])
  TO postgres, anon, authenticated, service_role;
