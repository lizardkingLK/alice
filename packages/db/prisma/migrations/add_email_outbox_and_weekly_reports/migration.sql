-- GI-656: durable email outbox, notification email preferences, and weekly reports.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'weekly_project_report';

CREATE TYPE "EmailOutboxStatus" AS ENUM (
  'pending',
  'processing',
  'retry',
  'sent',
  'cancelled',
  'dead'
);

CREATE TYPE "EmailTemplate" AS ENUM (
  'work_item_assignment',
  'work_item_reassignment',
  'work_item_status_change',
  'weekly_project_report'
);

ALTER TABLE "notifications" ADD COLUMN "dedupe_key" TEXT;

CREATE TABLE "notification_email_preferences" (
  "user_id" UUID NOT NULL,
  "email_enabled" BOOLEAN NOT NULL DEFAULT true,
  "work_item_assignment_enabled" BOOLEAN NOT NULL DEFAULT true,
  "work_item_reassignment_enabled" BOOLEAN NOT NULL DEFAULT true,
  "work_item_status_change_enabled" BOOLEAN NOT NULL DEFAULT true,
  "weekly_reports_enabled" BOOLEAN NOT NULL DEFAULT false,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "weekly_report_weekday" INTEGER NOT NULL DEFAULT 1,
  "weekly_report_hour" INTEGER NOT NULL DEFAULT 8,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_email_preferences_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "notification_email_preferences_weekday_check"
    CHECK ("weekly_report_weekday" BETWEEN 0 AND 6),
  CONSTRAINT "notification_email_preferences_hour_check"
    CHECK ("weekly_report_hour" BETWEEN 0 AND 23),
  CONSTRAINT "notification_email_preferences_timezone_not_blank_check"
    CHECK (length(btrim("timezone")) > 0)
);

CREATE TABLE "email_outbox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "notification_id" UUID,
  "user_id" UUID,
  "recipient_email" TEXT NOT NULL,
  "template" "EmailTemplate" NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "EmailOutboxStatus" NOT NULL DEFAULT 'pending',
  "idempotency_key" TEXT NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 8,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_by" TEXT,
  "locked_at" TIMESTAMPTZ(6),
  "locked_until" TIMESTAMPTZ(6),
  "last_attempt_at" TIMESTAMPTZ(6),
  "sent_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "failed_at" TIMESTAMPTZ(6),
  "provider_message_id" TEXT,
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_outbox_attempt_count_check" CHECK ("attempt_count" >= 0),
  CONSTRAINT "email_outbox_max_attempts_check" CHECK ("max_attempts" > 0),
  CONSTRAINT "email_outbox_attempt_limit_check"
    CHECK ("attempt_count" <= "max_attempts"),
  CONSTRAINT "email_outbox_recipient_not_blank_check"
    CHECK (length(btrim("recipient_email")) > 0),
  CONSTRAINT "email_outbox_idempotency_key_not_blank_check"
    CHECK (length(btrim("idempotency_key")) > 0)
);

CREATE TABLE "weekly_project_report_subscriptions" (
  "user_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "weekly_project_report_subscriptions_pkey"
    PRIMARY KEY ("user_id", "project_id")
);

CREATE TABLE "weekly_project_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "snapshot" JSONB NOT NULL,
  "notification_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "weekly_project_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "weekly_project_reports_period_check"
    CHECK ("period_end" >= "period_start")
);

CREATE UNIQUE INDEX "notifications_dedupe_key_key"
  ON "notifications"("dedupe_key");
CREATE UNIQUE INDEX "email_outbox_notification_id_key"
  ON "email_outbox"("notification_id");
CREATE UNIQUE INDEX "email_outbox_idempotency_key_key"
  ON "email_outbox"("idempotency_key");
CREATE INDEX "email_outbox_status_next_attempt_at_created_at_idx"
  ON "email_outbox"("status", "next_attempt_at", "created_at");
CREATE INDEX "email_outbox_status_locked_until_idx"
  ON "email_outbox"("status", "locked_until");
CREATE INDEX "email_outbox_user_id_created_at_idx"
  ON "email_outbox"("user_id", "created_at" DESC);
CREATE INDEX "weekly_project_report_subscriptions_project_id_enabled_idx"
  ON "weekly_project_report_subscriptions"("project_id", "enabled");
CREATE UNIQUE INDEX "weekly_project_reports_notification_id_key"
  ON "weekly_project_reports"("notification_id");
CREATE UNIQUE INDEX "weekly_project_reports_project_id_user_id_period_start_key"
  ON "weekly_project_reports"("project_id", "user_id", "period_start");
CREATE INDEX "weekly_project_reports_period_start_project_id_idx"
  ON "weekly_project_reports"("period_start", "project_id");

ALTER TABLE "notification_email_preferences"
  ADD CONSTRAINT "notification_email_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_outbox"
  ADD CONSTRAINT "email_outbox_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "notifications"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_outbox"
  ADD CONSTRAINT "email_outbox_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "weekly_project_report_subscriptions"
  ADD CONSTRAINT "weekly_project_report_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_project_report_subscriptions"
  ADD CONSTRAINT "weekly_project_report_subscriptions_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_project_reports"
  ADD CONSTRAINT "weekly_project_reports_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_project_reports"
  ADD CONSTRAINT "weekly_project_reports_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_project_reports"
  ADD CONSTRAINT "weekly_project_reports_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "notifications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Delivery addresses, payloads, and generated report snapshots are API-only.
REVOKE ALL ON TABLE "email_outbox" FROM anon, authenticated;
REVOKE ALL ON TABLE "weekly_project_reports" FROM anon, authenticated;
ALTER TABLE "email_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "weekly_project_reports" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "email_outbox" TO postgres, service_role;
GRANT ALL ON TABLE "weekly_project_reports" TO postgres, service_role;

-- Users may manage only their own email preferences and project subscriptions.
REVOKE ALL ON TABLE "notification_email_preferences" FROM anon, authenticated;
REVOKE ALL ON TABLE "weekly_project_report_subscriptions" FROM anon, authenticated;
ALTER TABLE "notification_email_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "weekly_project_report_subscriptions" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE "notification_email_preferences" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE "weekly_project_report_subscriptions" TO authenticated;
GRANT ALL ON TABLE "notification_email_preferences" TO postgres, service_role;
GRANT ALL ON TABLE "weekly_project_report_subscriptions" TO postgres, service_role;

CREATE POLICY "notification_email_preferences_select_own"
  ON "notification_email_preferences" FOR SELECT TO authenticated
  USING (auth.uid() = "user_id");
CREATE POLICY "notification_email_preferences_insert_own"
  ON "notification_email_preferences" FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = "user_id");
CREATE POLICY "notification_email_preferences_update_own"
  ON "notification_email_preferences" FOR UPDATE TO authenticated
  USING (auth.uid() = "user_id")
  WITH CHECK (auth.uid() = "user_id");
CREATE POLICY "notification_email_preferences_delete_own"
  ON "notification_email_preferences" FOR DELETE TO authenticated
  USING (auth.uid() = "user_id");

CREATE POLICY "weekly_project_report_subscriptions_select_own"
  ON "weekly_project_report_subscriptions" FOR SELECT TO authenticated
  USING (auth.uid() = "user_id");
CREATE POLICY "weekly_project_report_subscriptions_insert_own"
  ON "weekly_project_report_subscriptions" FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = "user_id"
    AND EXISTS (
      SELECT 1
      FROM "projects" AS p
      WHERE p."id" = "project_id"
        AND (
          p."owner_id" = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM "project_members" AS pm
            WHERE pm."project_id" = p."id"
              AND pm."user_id" = auth.uid()
              AND pm."status" = 'active'
          )
        )
    )
  );
CREATE POLICY "weekly_project_report_subscriptions_update_own"
  ON "weekly_project_report_subscriptions" FOR UPDATE TO authenticated
  USING (auth.uid() = "user_id")
  WITH CHECK (
    auth.uid() = "user_id"
    AND EXISTS (
      SELECT 1
      FROM "projects" AS p
      WHERE p."id" = "project_id"
        AND (
          p."owner_id" = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM "project_members" AS pm
            WHERE pm."project_id" = p."id"
              AND pm."user_id" = auth.uid()
              AND pm."status" = 'active'
          )
        )
    )
  );
CREATE POLICY "weekly_project_report_subscriptions_delete_own"
  ON "weekly_project_report_subscriptions" FOR DELETE TO authenticated
  USING (auth.uid() = "user_id");
