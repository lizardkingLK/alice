-- Hybrid VC connections: GitHub OAuth out of integrations → version_control_connections;
-- projects.github_* → vc_connection_id + vc_external; rename github_pull_requests.
-- Wire/RPC still expose github_* keys for adapters.
-- See docs/guides/RLS_HYBRID_ROLLOUT.md and docs/features/projects/GITHUB_INTEGRATION.md.

-- CreateEnum
CREATE TYPE "VersionControlVendor" AS ENUM ('github');

-- CreateEnum
CREATE TYPE "VersionControlConnectionStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "version_control_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "vendor" "VersionControlVendor" NOT NULL,
    "external_id" TEXT NOT NULL,
    "display_label" TEXT,
    "provider_config" JSONB NOT NULL DEFAULT '{}',
    "refresh_token_enc" TEXT NOT NULL,
    "access_token_enc" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(6),
    "scopes" TEXT NOT NULL,
    "status" "VersionControlConnectionStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "version_control_connections_pkey" PRIMARY KEY ("id")
);

-- Copy GitHub OAuth rows from integrations (preserve ids where created_by is set)
INSERT INTO "version_control_connections" (
    "id",
    "user_id",
    "vendor",
    "external_id",
    "display_label",
    "provider_config",
    "refresh_token_enc",
    "access_token_enc",
    "access_token_expires_at",
    "scopes",
    "status",
    "created_at",
    "updated_at"
)
SELECT
    i."id",
    i."created_by",
    'github'::"VersionControlVendor",
    COALESCE(
      NULLIF(btrim(i."config" ->> 'account_id'), ''),
      i."id"::text
    ),
    COALESCE(
      NULLIF(btrim(i."config" ->> 'account_login'), ''),
      NULLIF(btrim(i."name"), ''),
      'GitHub'
    ),
    jsonb_strip_nulls(
      jsonb_build_object(
        'account_login', i."config" ->> 'account_login',
        'account_name', i."config" ->> 'account_name',
        'account_avatar_url', i."config" ->> 'account_avatar_url',
        'authorized_repo', i."config" -> 'authorized_repo',
        'repositories', i."config" -> 'repositories'
      )
    ),
    COALESCE(i."config" ->> 'refresh_token', ''),
    i."config" ->> 'access_token',
    CASE
      WHEN i."config" ->> 'expires_at' IS NULL
        OR btrim(i."config" ->> 'expires_at') = '' THEN NULL
      ELSE (i."config" ->> 'expires_at')::timestamptz
    END,
    COALESCE(NULLIF(btrim(i."config" ->> 'scope'), ''), ''),
    CASE i."status"::text
      WHEN 'active' THEN 'active'::"VersionControlConnectionStatus"
      ELSE 'revoked'::"VersionControlConnectionStatus"
    END,
    i."created_at",
    i."updated_at"
FROM "integrations" i
WHERE i."provider" = 'github'
  AND i."created_by" IS NOT NULL;

DELETE FROM "integrations" WHERE "provider" = 'github';

CREATE INDEX "version_control_connections_user_id_idx"
  ON "version_control_connections"("user_id");

CREATE INDEX "version_control_connections_vendor_idx"
  ON "version_control_connections"("vendor");

CREATE UNIQUE INDEX "version_control_connections_user_id_vendor_external_id_key"
  ON "version_control_connections"("user_id", "vendor", "external_id");

ALTER TABLE "version_control_connections"
  ADD CONSTRAINT "version_control_connections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "version_control_connections" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "version_control_connections" FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- projects: github_* → vc_*
-- ---------------------------------------------------------------------------

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "vc_connection_id" UUID;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "vc_external" JSONB;

UPDATE "projects"
SET "vc_external" = jsonb_build_object(
  'vendor', 'github',
  'repo', "github_repo"
)
WHERE "github_repo" IS NOT NULL AND btrim("github_repo") <> '';

-- Best-effort: link project to the most recently updated active GitHub connection
UPDATE "projects" p
SET "vc_connection_id" = sub.id
FROM (
  SELECT DISTINCT ON (c."user_id") c."id", c."user_id"
  FROM "version_control_connections" c
  WHERE c."vendor" = 'github'
    AND c."status" = 'active'
  ORDER BY c."user_id", c."updated_at" DESC
) sub
WHERE p."owner_id" = sub."user_id"
  AND p."vc_connection_id" IS NULL
  AND p."vc_external" IS NOT NULL;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_vc_connection_id_fkey"
  FOREIGN KEY ("vc_connection_id")
  REFERENCES "version_control_connections"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "projects" DROP COLUMN IF EXISTS "github_repo";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "github_token";

-- ---------------------------------------------------------------------------
-- work_items PR child table rename
-- ---------------------------------------------------------------------------

ALTER TABLE "github_pull_requests"
  ADD COLUMN IF NOT EXISTS "vendor" "VersionControlVendor" NOT NULL DEFAULT 'github';

DROP INDEX IF EXISTS "github_pull_requests_work_item_id_repo_owner_repo_name_pr_n_key";
DROP INDEX IF EXISTS "github_pull_requests_work_item_id_repo_owner_repo_name_pr_number_key";

ALTER TABLE "github_pull_requests" RENAME TO "version_control_pull_requests";

ALTER TABLE "version_control_pull_requests"
  RENAME CONSTRAINT "github_pull_requests_pkey"
  TO "version_control_pull_requests_pkey";

ALTER TABLE "version_control_pull_requests"
  RENAME CONSTRAINT "github_pull_requests_work_item_id_fkey"
  TO "version_control_pull_requests_work_item_id_fkey";

CREATE UNIQUE INDEX "version_control_pull_requests_work_item_vendor_repo_pr_key"
  ON "version_control_pull_requests" (
    "work_item_id",
    "vendor",
    "repo_owner",
    "repo_name",
    "pr_number"
  );

CREATE INDEX IF NOT EXISTS "version_control_pull_requests_work_item_id_idx"
  ON "version_control_pull_requests"("work_item_id");

-- ---------------------------------------------------------------------------
-- RPC: keep github_* wire keys
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
            'github_repo', p.vc_external ->> 'repo',
            'logo_url', p.logo_url,
            'cover_picture', p.cover_picture,
            'attributes_config', p.attributes_config,
            'workflow_config', p.workflow_config,
            'created_by', p.created_by,
            'created_at', p.created_at,
            'updated_by', p.updated_by,
            'updated_at', p.updated_at,
            'deleted_at', p.deleted_at,
            'has_github_token', (p.vc_connection_id IS NOT NULL),
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
REVOKE ALL ON TABLE public.version_control_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.chat_attachments FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_allowlist FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_requests FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_project_workspace_bundle(uuid)
  TO postgres, anon, authenticated, service_role;
