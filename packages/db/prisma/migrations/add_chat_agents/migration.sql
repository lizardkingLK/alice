-- CreateEnum
CREATE TYPE "ChatAgentAutonomy" AS ENUM ('suggest', 'approve');

-- AlterTable
ALTER TABLE "chat_conversations" ADD COLUMN "agent_id" UUID;

-- CreateTable
CREATE TABLE "chat_tools" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "instruction" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_skills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_agents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT,
    "owner_id" UUID,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL,
    "autonomy" "ChatAgentAutonomy" NOT NULL DEFAULT 'suggest',
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "forked_from_id" UUID,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "tagline" TEXT NOT NULL DEFAULT '',
    "avatar_style" TEXT NOT NULL DEFAULT 'lorelei',
    "avatar_seed" TEXT NOT NULL DEFAULT '',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_agent_tools" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_agent_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_agent_skills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_agent_skills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_tools_key_key" ON "chat_tools"("key");
CREATE INDEX "chat_tools_status_sort_order_idx" ON "chat_tools"("status", "sort_order");
CREATE UNIQUE INDEX "chat_skills_key_key" ON "chat_skills"("key");
CREATE INDEX "chat_skills_status_sort_order_idx" ON "chat_skills"("status", "sort_order");
CREATE UNIQUE INDEX "chat_agents_key_key" ON "chat_agents"("key");
CREATE INDEX "chat_agents_owner_id_status_idx" ON "chat_agents"("owner_id", "status");
CREATE INDEX "chat_agents_status_is_default_idx" ON "chat_agents"("status", "is_default");
CREATE INDEX "chat_agents_forked_from_id_idx" ON "chat_agents"("forked_from_id");
CREATE INDEX "chat_agent_tools_tool_id_idx" ON "chat_agent_tools"("tool_id");
CREATE UNIQUE INDEX "chat_agent_tools_agent_id_tool_id_key" ON "chat_agent_tools"("agent_id", "tool_id");
CREATE INDEX "chat_agent_skills_skill_id_idx" ON "chat_agent_skills"("skill_id");
CREATE UNIQUE INDEX "chat_agent_skills_agent_id_skill_id_key" ON "chat_agent_skills"("agent_id", "skill_id");
CREATE INDEX "chat_conversations_agent_id_idx" ON "chat_conversations"("agent_id");

-- At most one active workspace default agent.
CREATE UNIQUE INDEX "chat_agents_one_active_default_key"
  ON "chat_agents" ("is_default")
  WHERE "is_default" = true AND "status" = 'active';

-- Each user may fork a given admin original at most once (active rows).
CREATE UNIQUE INDEX "chat_agents_one_fork_per_owner_source_key"
  ON "chat_agents" ("owner_id", "forked_from_id")
  WHERE "owner_id" IS NOT NULL
    AND "forked_from_id" IS NOT NULL
    AND "status" = 'active';

-- AddForeignKey
ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "chat_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chat_agents"
  ADD CONSTRAINT "chat_agents_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_agents"
  ADD CONSTRAINT "chat_agents_forked_from_id_fkey"
  FOREIGN KEY ("forked_from_id") REFERENCES "chat_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chat_agents"
  ADD CONSTRAINT "chat_agents_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chat_agents"
  ADD CONSTRAINT "chat_agents_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chat_agent_tools"
  ADD CONSTRAINT "chat_agent_tools_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "chat_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_agent_tools"
  ADD CONSTRAINT "chat_agent_tools_tool_id_fkey"
  FOREIGN KEY ("tool_id") REFERENCES "chat_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_agent_skills"
  ADD CONSTRAINT "chat_agent_skills_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "chat_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_agent_skills"
  ADD CONSTRAINT "chat_agent_skills_skill_id_fkey"
  FOREIGN KEY ("skill_id") REFERENCES "chat_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: catalogs — authenticated SELECT; mutations via service_role / API.
ALTER TABLE "chat_tools" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_skills" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_tools_select_authenticated" ON public.chat_tools
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "chat_tools_service_role_all" ON public.chat_tools
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "chat_skills_select_authenticated" ON public.chat_skills
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "chat_skills_service_role_all" ON public.chat_skills
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS: agents — admin originals (owner_id null) readable by all authenticated;
-- forks readable/writable by owner; admin original writes via service_role.
ALTER TABLE "chat_agents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_agents_select_visible" ON public.chat_agents
  FOR SELECT TO authenticated
  USING (
    "owner_id" IS NULL
    OR (SELECT auth.uid()) = "owner_id"
  );

CREATE POLICY "chat_agents_insert_own_fork" ON public.chat_agents
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = "owner_id"
    AND "forked_from_id" IS NOT NULL
  );

CREATE POLICY "chat_agents_update_own_fork" ON public.chat_agents
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = "owner_id")
  WITH CHECK ((SELECT auth.uid()) = "owner_id");

CREATE POLICY "chat_agents_delete_own_fork" ON public.chat_agents
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = "owner_id");

CREATE POLICY "chat_agents_service_role_all" ON public.chat_agents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS: join enablement — visible with parent agent; mutate only own forks.
ALTER TABLE "chat_agent_tools" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_agent_skills" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_agent_tools_select_visible" ON public.chat_agent_tools
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_agents a
      WHERE a.id = agent_id
        AND (a.owner_id IS NULL OR a.owner_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "chat_agent_tools_insert_own_fork" ON public.chat_agent_tools
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_agents a
      WHERE a.id = agent_id
        AND a.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "chat_agent_tools_update_own_fork" ON public.chat_agent_tools
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_agents a
      WHERE a.id = agent_id
        AND a.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_agents a
      WHERE a.id = agent_id
        AND a.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "chat_agent_tools_delete_own_fork" ON public.chat_agent_tools
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_agents a
      WHERE a.id = agent_id
        AND a.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "chat_agent_tools_service_role_all" ON public.chat_agent_tools
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "chat_agent_skills_select_visible" ON public.chat_agent_skills
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_agents a
      WHERE a.id = agent_id
        AND (a.owner_id IS NULL OR a.owner_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "chat_agent_skills_insert_own_fork" ON public.chat_agent_skills
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_agents a
      WHERE a.id = agent_id
        AND a.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "chat_agent_skills_update_own_fork" ON public.chat_agent_skills
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_agents a
      WHERE a.id = agent_id
        AND a.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_agents a
      WHERE a.id = agent_id
        AND a.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "chat_agent_skills_delete_own_fork" ON public.chat_agent_skills
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_agents a
      WHERE a.id = agent_id
        AND a.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "chat_agent_skills_service_role_all" ON public.chat_agent_skills
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

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
REVOKE ALL ON TABLE public._prisma_migrations FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon, authenticated;
