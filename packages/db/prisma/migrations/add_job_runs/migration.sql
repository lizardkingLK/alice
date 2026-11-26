-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_id" UUID,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "bullmq_job_id" TEXT,
    "event_id" TEXT,
    "event_type" TEXT,
    "delivery_id" TEXT,
    "project_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_runs_event_id_key" ON "job_runs"("event_id");

-- CreateIndex
CREATE INDEX "job_runs_kind_status_idx" ON "job_runs"("kind", "status");

-- CreateIndex
CREATE INDEX "job_runs_delivery_id_idx" ON "job_runs"("delivery_id");

-- CreateIndex
CREATE INDEX "job_runs_parent_id_idx" ON "job_runs"("parent_id");

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "job_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_runs" ENABLE ROW LEVEL SECURITY;

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

-- Hybrid RLS P0: re-lock Prisma-only tables after blanket GRANTs.
REVOKE ALL ON TABLE public.integrations FROM anon, authenticated;
REVOKE ALL ON TABLE public.project_management_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.version_control_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.version_control_branches FROM anon, authenticated;
REVOKE ALL ON TABLE public.version_control_commits FROM anon, authenticated;
REVOKE ALL ON TABLE public.job_runs FROM anon, authenticated;
REVOKE ALL ON TABLE public.chat_attachments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.chat_tools FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.chat_skills FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_allowlist FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.work_item_links FROM anon, authenticated;
REVOKE ALL ON TABLE public.work_item_chart_rollups FROM anon, authenticated;
REVOKE ALL ON TABLE public.work_item_chart_hierarchy_rollups FROM anon, authenticated;
REVOKE ALL ON TABLE public.sprint_burndown_rollups FROM anon, authenticated;
REVOKE ALL ON TABLE public.sprint_contribution_rollups FROM anon, authenticated;
REVOKE ALL ON TABLE public.email_outbox FROM anon, authenticated;
REVOKE ALL ON TABLE public.notification_email_events FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT SELECT, INSERT ON TABLE public.notification_email_events TO postgres;
REVOKE ALL ON TABLE public.weekly_project_reports FROM anon, authenticated;
REVOKE ALL ON TABLE public._prisma_migrations FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon, authenticated;
