-- CreateTable
CREATE TABLE "version_control_branches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "work_item_id" UUID,
    "vendor" "VersionControlVendor" NOT NULL DEFAULT 'github',
    "repo_owner" TEXT NOT NULL,
    "repo_name" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "head_sha" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "version_control_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "version_control_commits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "work_item_id" UUID,
    "vendor" "VersionControlVendor" NOT NULL DEFAULT 'github',
    "repo_owner" TEXT NOT NULL,
    "repo_name" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT,
    "author_login" TEXT,
    "author_name" TEXT,
    "author_email" TEXT,
    "committed_at" TIMESTAMPTZ(6),
    "html_url" TEXT,
    "branch_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "version_control_commits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "version_control_branches_project_id_vendor_repo_owner_repo_name_name_key" ON "version_control_branches"("project_id", "vendor", "repo_owner", "repo_name", "name");

-- CreateIndex
CREATE INDEX "version_control_branches_project_id_idx" ON "version_control_branches"("project_id");

-- CreateIndex
CREATE INDEX "version_control_branches_work_item_id_idx" ON "version_control_branches"("work_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "version_control_commits_project_id_vendor_repo_owner_repo_name_sha_key" ON "version_control_commits"("project_id", "vendor", "repo_owner", "repo_name", "sha");

-- CreateIndex
CREATE INDEX "version_control_commits_project_id_idx" ON "version_control_commits"("project_id");

-- CreateIndex
CREATE INDEX "version_control_commits_work_item_id_idx" ON "version_control_commits"("work_item_id");

-- CreateIndex
CREATE INDEX "version_control_commits_branch_name_idx" ON "version_control_commits"("branch_name");

-- AddForeignKey
ALTER TABLE "version_control_branches" ADD CONSTRAINT "version_control_branches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_control_branches" ADD CONSTRAINT "version_control_branches_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_control_commits" ADD CONSTRAINT "version_control_commits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_control_commits" ADD CONSTRAINT "version_control_commits_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma-only (worker / API): lock out PostgREST roles.
ALTER TABLE "version_control_branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "version_control_commits" ENABLE ROW LEVEL SECURITY;

-- Restore Supabase Data API access after Prisma DDL.
-- Prisma runs as postgres; PostgREST uses anon, authenticated, and service_role.
-- Without these grants, seed (service_role) and client queries fail with
-- "permission denied for schema public".

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

-- Hybrid RLS P0: re-lock secrets / admission tables after the blanket GRANTs above.
-- See docs/guides/RLS_HYBRID_ROLLOUT.md. Idempotent for migrate:deploy / create:migrate.
REVOKE ALL ON TABLE public.integrations FROM anon, authenticated;
REVOKE ALL ON TABLE public.project_management_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.version_control_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.version_control_branches FROM anon, authenticated;
REVOKE ALL ON TABLE public.version_control_commits FROM anon, authenticated;
REVOKE ALL ON TABLE public.chat_attachments FROM anon, authenticated;
-- Chat agent catalogs: authenticated may SELECT (RLS); writes via service_role / API.
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
