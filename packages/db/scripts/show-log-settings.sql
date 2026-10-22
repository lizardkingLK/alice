-- Snapshot Postgres log-related settings (ops / log-ingest tuning).
-- Usage: psql "$DIRECT_URL" -f packages/db/scripts/show-log-settings.sql
-- See docs/guides/SUPABASE_LOG_INGEST.md.

SELECT name, setting, source, context
FROM pg_settings
WHERE name IN (
  'log_statement',
  'log_min_duration_statement',
  'log_min_messages',
  'log_connections',
  'log_disconnections',
  'log_lock_waits',
  'log_temp_files',
  'log_duration',
  'log_autovacuum_min_duration',
  'log_checkpoints',
  'cron.log_statement',
  'cron.log_run',
  'pgaudit.log'
)
ORDER BY name;

SELECT rolname, rolconfig
FROM pg_roles
WHERE rolname IN (
  'postgres',
  'authenticator',
  'anon',
  'authenticated',
  'service_role'
)
ORDER BY rolname;
