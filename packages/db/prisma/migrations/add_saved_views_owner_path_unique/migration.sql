-- Remove duplicate active saved views (keep most recently updated per owner + path).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY owner_id, pathname, search
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM saved_views
  WHERE status = 'active'
)
DELETE FROM saved_views
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- One active saved view per owner per pathname + search.
CREATE UNIQUE INDEX IF NOT EXISTS saved_views_owner_path_active_key
  ON saved_views (owner_id, pathname, search)
  WHERE status = 'active';
