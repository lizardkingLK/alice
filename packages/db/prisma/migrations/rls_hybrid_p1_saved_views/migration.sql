-- P1 Strategy B: saved_views + saved_view_shares (charts-shaped owner/share ACL).
-- See docs/guides/RLS_HYBRID_ROLLOUT.md and docs/features/views/FAVORITES_AND_VIEWS.md.

ALTER TABLE "saved_views" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_view_shares" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_views_owner_all" ON "saved_views";
CREATE POLICY "saved_views_owner_all" ON "saved_views"
  FOR ALL TO authenticated
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "saved_views_shared_select" ON "saved_views";
CREATE POLICY "saved_views_shared_select" ON "saved_views"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM saved_view_shares s
      WHERE s.view_id = saved_views.id
        AND s.user_id = (select auth.uid())
        AND s.status = 'active'
    )
  );

DROP POLICY IF EXISTS "saved_view_shares_owner_all" ON "saved_view_shares";
CREATE POLICY "saved_view_shares_owner_all" ON "saved_view_shares"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM saved_views v
      WHERE v.id = saved_view_shares.view_id
        AND v.owner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM saved_views v
      WHERE v.id = saved_view_shares.view_id
        AND v.owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "saved_view_shares_recipient_select" ON "saved_view_shares";
CREATE POLICY "saved_view_shares_recipient_select" ON "saved_view_shares"
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
