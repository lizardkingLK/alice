-- Idempotent unique index for environments that already applied the column-only migration.
CREATE UNIQUE INDEX IF NOT EXISTS "work_items_project_id_jira_issue_key_key"
  ON "work_items" ("project_id", "jira_issue_key")
  WHERE "jira_issue_key" IS NOT NULL;
