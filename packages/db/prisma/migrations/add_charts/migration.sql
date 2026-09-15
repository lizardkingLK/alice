-- AlterEnum: chart share notifications
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'chart_shared';

CREATE TABLE IF NOT EXISTS "charts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "board_json" JSONB NOT NULL DEFAULT '{}',
  "is_overview" BOOLEAN NOT NULL DEFAULT false,
  "status" "RecordStatus" NOT NULL DEFAULT 'active',
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "charts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chart_shares" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "chart_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'active',
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chart_shares_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "charts"
    ADD CONSTRAINT "charts_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "charts"
    ADD CONSTRAINT "charts_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "charts"
    ADD CONSTRAINT "charts_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "chart_shares"
    ADD CONSTRAINT "chart_shares_chart_id_fkey"
    FOREIGN KEY ("chart_id") REFERENCES "charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "chart_shares"
    ADD CONSTRAINT "chart_shares_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "chart_shares"
    ADD CONSTRAINT "chart_shares_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "chart_shares"
    ADD CONSTRAINT "chart_shares_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "chart_shares_chart_id_user_id_key"
  ON "chart_shares"("chart_id", "user_id");

CREATE INDEX IF NOT EXISTS "charts_owner_id_status_idx" ON "charts"("owner_id", "status");
CREATE INDEX IF NOT EXISTS "chart_shares_user_id_status_idx" ON "chart_shares"("user_id", "status");

-- At most one active overview chart per owner
CREATE UNIQUE INDEX IF NOT EXISTS "charts_owner_overview_active_key"
  ON "charts"("owner_id")
  WHERE "is_overview" = true AND "status" = 'active';

ALTER TABLE "charts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chart_shares" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "charts_owner_all" ON "charts";
CREATE POLICY "charts_owner_all" ON "charts"
  FOR ALL TO authenticated
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "charts_shared_select" ON "charts";
CREATE POLICY "charts_shared_select" ON "charts"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chart_shares s
      WHERE s.chart_id = charts.id
        AND s.user_id = (select auth.uid())
        AND s.status = 'active'
    )
  );

DROP POLICY IF EXISTS "chart_shares_owner_all" ON "chart_shares";
CREATE POLICY "chart_shares_owner_all" ON "chart_shares"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM charts c
      WHERE c.id = chart_shares.chart_id AND c.owner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM charts c
      WHERE c.id = chart_shares.chart_id AND c.owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "chart_shares_recipient_select" ON "chart_shares";
CREATE POLICY "chart_shares_recipient_select" ON "chart_shares"
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
