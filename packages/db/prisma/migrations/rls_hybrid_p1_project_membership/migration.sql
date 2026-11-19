-- P1 Strategy B: membership-gated SELECT on collaborative tables.
-- Shared helper mirrors apps/web project-workspace-access (guest allowlist exclusive,
-- else owner ∪ active project_members). Mutations stay service-role / Prisma.
-- See docs/guides/RLS_HYBRID_ROLLOUT.md.

-- ---------------------------------------------------------------------------
-- Helper (SECURITY DEFINER — reads allowlist + membership without RLS recursion)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_project_id IS NULL THEN false
    WHEN (SELECT auth.uid()) IS NULL THEN false
    -- Active email allowlist row: exclusive ACL by project key
    WHEN EXISTS (
      SELECT 1
      FROM public.access_allowlist aa
      INNER JOIN public.users u ON u.id = (SELECT auth.uid())
      WHERE aa.status = 'active'
        AND aa.kind = 'email'
        AND aa.value = lower(u.email)
    ) THEN EXISTS (
      SELECT 1
      FROM public.access_allowlist aa
      INNER JOIN public.users u ON u.id = (SELECT auth.uid())
      INNER JOIN public.projects p ON p.id = p_project_id
      WHERE aa.status = 'active'
        AND aa.kind = 'email'
        AND aa.value = lower(u.email)
        AND aa.allowed_project_ids IS NOT NULL
        AND jsonb_typeof(aa.allowed_project_ids) = 'array'
        AND upper(trim(p.key)) IN (
          SELECT upper(trim(elem))
          FROM jsonb_array_elements_text(aa.allowed_project_ids) AS t(elem)
          WHERE btrim(elem) <> ''
        )
    )
    -- Otherwise: owner or active member
    ELSE (
      EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = p_project_id
          AND p.owner_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.project_id = p_project_id
          AND pm.user_id = (SELECT auth.uid())
          AND pm.status = 'active'
      )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.can_access_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- projects / project_members / teams / team_members
-- ---------------------------------------------------------------------------

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_accessible" ON public.projects;
CREATE POLICY "projects_select_accessible" ON public.projects
  FOR SELECT TO authenticated
  USING (public.can_access_project(id));

DROP POLICY IF EXISTS "project_members_select_accessible" ON public.project_members;
CREATE POLICY "project_members_select_accessible" ON public.project_members
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.can_access_project(project_id)
  );

DROP POLICY IF EXISTS "teams_select_accessible" ON public.teams;
CREATE POLICY "teams_select_accessible" ON public.teams
  FOR SELECT TO authenticated
  USING (
    project_id IS NOT NULL
    AND public.can_access_project(project_id)
  );

DROP POLICY IF EXISTS "team_members_select_accessible" ON public.team_members;
CREATE POLICY "team_members_select_accessible" ON public.team_members
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_members.team_id
        AND t.project_id IS NOT NULL
        AND public.can_access_project(t.project_id)
    )
  );

-- ---------------------------------------------------------------------------
-- work_items + related
-- ---------------------------------------------------------------------------

ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_item_worklogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.version_control_pull_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_items_select_accessible" ON public.work_items;
CREATE POLICY "work_items_select_accessible" ON public.work_items
  FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS "sprints_select_accessible" ON public.sprints;
CREATE POLICY "sprints_select_accessible" ON public.sprints
  FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS "comments_select_accessible" ON public.comments;
CREATE POLICY "comments_select_accessible" ON public.comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.work_items wi
      WHERE wi.id = comments.work_item_id
        AND public.can_access_project(wi.project_id)
    )
  );

DROP POLICY IF EXISTS "attachments_select_accessible" ON public.attachments;
CREATE POLICY "attachments_select_accessible" ON public.attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.work_items wi
      WHERE wi.id = attachments.work_item_id
        AND public.can_access_project(wi.project_id)
    )
  );

DROP POLICY IF EXISTS "work_item_worklogs_select_accessible" ON public.work_item_worklogs;
CREATE POLICY "work_item_worklogs_select_accessible" ON public.work_item_worklogs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.work_items wi
      WHERE wi.id = work_item_worklogs.work_item_id
        AND public.can_access_project(wi.project_id)
    )
  );

DROP POLICY IF EXISTS "vc_prs_select_accessible" ON public.version_control_pull_requests;
CREATE POLICY "vc_prs_select_accessible" ON public.version_control_pull_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.work_items wi
      WHERE wi.id = version_control_pull_requests.work_item_id
        AND public.can_access_project(wi.project_id)
    )
  );

-- ---------------------------------------------------------------------------
-- activities: tighten weak "parent WI exists" policy
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated select activities" ON public.activities;
CREATE POLICY "activities_select_accessible" ON public.activities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.work_items wi
      WHERE wi.id = activities.work_item_id
        AND public.can_access_project(wi.project_id)
    )
  );

-- Keep service_role ALL if present
DROP POLICY IF EXISTS "Allow service_role all activities" ON public.activities;
CREATE POLICY "activities_service_role_all" ON public.activities
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
