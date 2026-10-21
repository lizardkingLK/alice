-- Quiet remaining Postgres log noise for Logs Ingest (Free-plan quota).
-- Safe defaults: no statement text dump; keep warnings+ errors.
-- New sessions pick these up — reconnect Prisma / API after apply.
-- See docs/guides/SUPABASE_LOG_INGEST.md.

ALTER ROLE postgres SET log_statement TO 'none';
ALTER ROLE postgres SET log_lock_waits TO 'off';

-- Verify role overrides (effective setting may still show config-file until reconnect)
SELECT rolname, rolconfig
FROM pg_roles
WHERE rolname = 'postgres';
