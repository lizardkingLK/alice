-- Break saved_views ↔ saved_view_shares RLS recursion.
-- Cross-table EXISTS policies re-enter each other's RLS and Postgres raises:
--   infinite recursion detected in policy for relation "saved_views"
-- SECURITY DEFINER helpers read ACL rows without re-applying RLS (same pattern
-- as public.can_access_project). Also harden charts / chart_shares the same way.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_saved_view_shared_with_me(p_view_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.saved_view_shares s
    WHERE s.view_id = p_view_id
      AND s.user_id = (SELECT auth.uid())
      AND s.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_saved_view_owned_by_me(p_view_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.saved_views v
    WHERE v.id = p_view_id
      AND v.owner_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_chart_shared_with_me(p_chart_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chart_shares s
    WHERE s.chart_id = p_chart_id
      AND s.user_id = (SELECT auth.uid())
      AND s.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_chart_owned_by_me(p_chart_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.charts c
    WHERE c.id = p_chart_id
      AND c.owner_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_saved_view_shared_with_me(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_saved_view_owned_by_me(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_chart_shared_with_me(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_chart_owned_by_me(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_saved_view_shared_with_me(uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_saved_view_owned_by_me(uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_chart_shared_with_me(uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_chart_owned_by_me(uuid)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- saved_views / saved_view_shares
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "saved_views_shared_select" ON "saved_views";
CREATE POLICY "saved_views_shared_select" ON "saved_views"
  FOR SELECT TO authenticated
  USING (public.is_saved_view_shared_with_me(id));

DROP POLICY IF EXISTS "saved_view_shares_owner_all" ON "saved_view_shares";
CREATE POLICY "saved_view_shares_owner_all" ON "saved_view_shares"
  FOR ALL TO authenticated
  USING (public.is_saved_view_owned_by_me(view_id))
  WITH CHECK (public.is_saved_view_owned_by_me(view_id));

-- ---------------------------------------------------------------------------
-- charts / chart_shares (same cycle; fix before it surfaces on shared charts)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "charts_shared_select" ON "charts";
CREATE POLICY "charts_shared_select" ON "charts"
  FOR SELECT TO authenticated
  USING (public.is_chart_shared_with_me(id));

DROP POLICY IF EXISTS "chart_shares_owner_all" ON "chart_shares";
CREATE POLICY "chart_shares_owner_all" ON "chart_shares"
  FOR ALL TO authenticated
  USING (public.is_chart_owned_by_me(chart_id))
  WITH CHECK (public.is_chart_owned_by_me(chart_id));
