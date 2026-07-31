-- Enforce a single jira_settings row and harden Data API access.

-- Keep one settings row if duplicates already exist.
DELETE FROM "jira_settings"
WHERE "id" NOT IN (
  SELECT "id" FROM "jira_settings" ORDER BY "created_at" ASC LIMIT 1
);

ALTER TABLE "jira_settings"
  ADD COLUMN IF NOT EXISTS "singleton" BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE "jira_settings" SET "singleton" = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS "jira_settings_singleton_key"
  ON "jira_settings" ("singleton");

-- Credentials table: service_role only (API uses service role).
REVOKE ALL ON TABLE "jira_settings" FROM anon, authenticated;
ALTER TABLE "jira_settings" ENABLE ROW LEVEL SECURITY;
