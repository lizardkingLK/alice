-- URL tree masks: per-project unique slugs for sprints and work items.

ALTER TABLE "sprints" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "work_items" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Temporary slugify for backfill (lowercase kebab; empty → 'item').
CREATE OR REPLACE FUNCTION public._tmp_slugify(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      trim(
        both '-' FROM lower(
          regexp_replace(
            regexp_replace(COALESCE(p_value, ''), '[^a-zA-Z0-9]+', '-', 'g'),
            '-+',
            '-',
            'g'
          )
        )
      ),
      ''
    ),
    'item'
  );
$$;

-- Backfill sprint slugs (unique within project; append -2, -3, … on collide).
WITH ranked AS (
  SELECT
    id,
    project_id,
    public._tmp_slugify(name) AS base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, public._tmp_slugify(name)
      ORDER BY created_at, id
    ) AS rn
  FROM public.sprints
  WHERE slug IS NULL OR slug = ''
)
UPDATE public.sprints s
SET slug = CASE
  WHEN r.rn = 1 THEN left(r.base_slug, 80)
  ELSE left(r.base_slug, greatest(1, 80 - length('-' || r.rn::text))) || '-' || r.rn::text
END
FROM ranked r
WHERE s.id = r.id;

-- Backfill work item slugs (unique within project).
WITH ranked AS (
  SELECT
    id,
    project_id,
    public._tmp_slugify(title) AS base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, public._tmp_slugify(title)
      ORDER BY created_at, id
    ) AS rn
  FROM public.work_items
  WHERE slug IS NULL OR slug = ''
)
UPDATE public.work_items w
SET slug = CASE
  WHEN r.rn = 1 THEN left(r.base_slug, 80)
  ELSE left(r.base_slug, greatest(1, 80 - length('-' || r.rn::text))) || '-' || r.rn::text
END
FROM ranked r
WHERE w.id = r.id;

ALTER TABLE "sprints" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "work_items" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "sprints_project_id_slug_key"
  ON public.sprints (project_id, slug);

CREATE UNIQUE INDEX IF NOT EXISTS "work_items_project_id_slug_key"
  ON public.work_items (project_id, slug);

DROP FUNCTION IF EXISTS public._tmp_slugify(text);

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
