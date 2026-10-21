-- P2: API-only revoke for rollups + work_item_links; harden notifications/chat policies.
-- See docs/guides/RLS_HYBRID_ROLLOUT.md.

-- ---------------------------------------------------------------------------
-- Strategy A — precomputed / link tables (Prisma / service_role only)
-- ---------------------------------------------------------------------------

ALTER TABLE public.work_item_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_item_chart_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_item_chart_hierarchy_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_burndown_rollups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.work_item_links FROM anon, authenticated;
REVOKE ALL ON TABLE public.work_item_chart_rollups FROM anon, authenticated;
REVOKE ALL ON TABLE public.work_item_chart_hierarchy_rollups FROM anon, authenticated;
REVOKE ALL ON TABLE public.sprint_burndown_rollups FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- notifications: create via API only; clients SELECT/UPDATE own rows
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.notifications;
DROP POLICY IF EXISTS "Allow service_role all" ON public.notifications;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "notifications_service_role_all" ON public.notifications
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- chat_conversations: wrap auth.uid() for planner caching (same ACL)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.chat_conversations;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.chat_conversations;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.chat_conversations;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.chat_conversations;
DROP POLICY IF EXISTS "Allow service_role all" ON public.chat_conversations;

CREATE POLICY "chat_conversations_insert_own" ON public.chat_conversations
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "chat_conversations_select_own" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "chat_conversations_update_own" ON public.chat_conversations
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "chat_conversations_delete_own" ON public.chat_conversations
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "chat_conversations_service_role_all" ON public.chat_conversations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- charts / chart_shares already use (select auth.uid()) — no change.

-- Restore grants then re-revoke Strategy A tables (Prisma DDL hygiene).
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

REVOKE ALL ON TABLE public.integrations FROM anon, authenticated;
REVOKE ALL ON TABLE public.project_management_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.version_control_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.chat_attachments FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_allowlist FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.work_item_links FROM anon, authenticated;
REVOKE ALL ON TABLE public.work_item_chart_rollups FROM anon, authenticated;
REVOKE ALL ON TABLE public.work_item_chart_hierarchy_rollups FROM anon, authenticated;
REVOKE ALL ON TABLE public.sprint_burndown_rollups FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon, authenticated;
