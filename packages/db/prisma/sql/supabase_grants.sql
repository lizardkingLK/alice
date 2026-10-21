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
REVOKE ALL ON TABLE public.access_allowlist FROM anon, authenticated;
REVOKE ALL ON TABLE public.access_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.work_item_links FROM anon, authenticated;
REVOKE ALL ON TABLE public.work_item_chart_rollups FROM anon, authenticated;
REVOKE ALL ON TABLE public.work_item_chart_hierarchy_rollups FROM anon, authenticated;
REVOKE ALL ON TABLE public.sprint_burndown_rollups FROM anon, authenticated;
REVOKE ALL ON TABLE public._prisma_migrations FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon, authenticated;
