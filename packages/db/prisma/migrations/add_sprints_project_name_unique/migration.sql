-- Deduplicate sprint names within a project before adding uniqueness.
-- Keep the earliest row; rename later duplicates with a stable id suffix.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, name
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM sprints
)
UPDATE sprints AS s
SET name = s.name || ' · ' || LEFT(s.id::text, 8)
FROM ranked
WHERE s.id = ranked.id
  AND ranked.rn > 1;

-- Sprint names must be unique per project across all statuses (including archived).
CREATE UNIQUE INDEX IF NOT EXISTS "sprints_project_id_name_key"
ON "sprints"("project_id", "name");
