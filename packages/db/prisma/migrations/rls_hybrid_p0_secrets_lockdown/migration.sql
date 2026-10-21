-- Hybrid RLS P0: lock secrets / admission tables for PostgREST (anon + authenticated).
-- Service role / Prisma continue to bypass. App callers must use admin/API paths.
-- See docs/guides/RLS_HYBRID_ROLLOUT.md.

-- ---------------------------------------------------------------------------
-- Full-table lockdown (Strategy A)
-- ---------------------------------------------------------------------------

-- Prefer project_management_connections (post hybrid rename). Keep jira_connections
-- branch for DBs that still have the old table name when this runs alone.
DO $$
BEGIN
  IF to_regclass('public.project_management_connections') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.project_management_connections ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.project_management_connections FROM anon, authenticated';
  ELSIF to_regclass('public.jira_connections') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.jira_connections ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.jira_connections FROM anon, authenticated';
  END IF;
END $$;

ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chat_attachments FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_allowlist FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.integrations FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- users: stop anon dumps; keep authenticated directory SELECT; writes via service role
-- ---------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_authenticated_select" ON public.users;
CREATE POLICY "users_authenticated_select"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon, authenticated;

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
DO $$
BEGIN
  IF to_regclass('public.project_management_connections') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.project_management_connections FROM anon, authenticated';
  ELSIF to_regclass('public.jira_connections') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.jira_connections FROM anon, authenticated';
  END IF;
END $$;
REVOKE ALL ON TABLE public.chat_attachments FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_allowlist FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_requests FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon, authenticated;
