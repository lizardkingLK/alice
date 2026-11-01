-- Dynamic work-item type catalogs: WorkItemType enum → text keys + JSON defs backfill.
-- Do NOT use DROP COLUMN/ADD COLUMN (would wipe type data). Prisma migrate diff is unsafe here.

-- 1) Drop functions that still take "WorkItemType" args (recreated as text below).
DROP FUNCTION IF EXISTS public.get_work_items_hierarchy_page(
  integer, integer, text, uuid, uuid[], uuid, boolean, "WorkItemType", uuid, jsonb, text, uuid
);
DROP FUNCTION IF EXISTS public.work_item_chart_rollup_grain_key(
  date, uuid, uuid, "WorkItemStatus", text, text, text, "WorkItemType", "WorkItemPriority", uuid
);
DROP FUNCTION IF EXISTS public.work_item_chart_rollup_apply_delta(
  date, uuid, uuid, "WorkItemStatus", text, text, text, "WorkItemType", "WorkItemPriority", uuid, integer
);
DROP FUNCTION IF EXISTS public.work_item_chart_hierarchy_rollup_upsert(
  uuid, uuid, uuid, uuid, date, "WorkItemStatus", text, text, text, "WorkItemType", "WorkItemPriority", uuid, integer
);

-- 2) Convert columns to text (preserve values).
ALTER TABLE "work_items"
  ALTER COLUMN "type" TYPE text USING ("type"::text);
ALTER TABLE "work_item_chart_rollups"
  ALTER COLUMN "type" TYPE text USING ("type"::text);
ALTER TABLE "work_item_chart_hierarchy_rollups"
  ALTER COLUMN "type" TYPE text USING ("type"::text);

CREATE OR REPLACE FUNCTION public.work_item_chart_rollup_grain_key(p_bucket_date date, p_project_id uuid, p_sprint_id uuid, p_status "WorkItemStatus", p_status_category text, p_workflow_id text, p_state_id text, p_type text, p_priority "WorkItemPriority", p_assignee_id uuid)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT concat_ws(
    '|',
    p_bucket_date::text,
    p_project_id::text,
    coalesce(p_sprint_id::text, ''),
    p_status::text,
    p_status_category,
    p_workflow_id,
    p_state_id,
    p_type::text,
    p_priority::text,
    coalesce(p_assignee_id::text, '')
  );
$function$
;
CREATE OR REPLACE FUNCTION public.work_item_chart_rollup_apply_delta(p_bucket_date date, p_project_id uuid, p_sprint_id uuid, p_status "WorkItemStatus", p_status_category text, p_workflow_id text, p_state_id text, p_type text, p_priority "WorkItemPriority", p_assignee_id uuid, p_delta integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_key text;
BEGIN
  IF p_delta = 0 THEN
    RETURN;
  END IF;

  v_key := public.work_item_chart_rollup_grain_key(
    p_bucket_date,
    p_project_id,
    p_sprint_id,
    p_status,
    p_status_category,
    p_workflow_id,
    p_state_id,
    p_type,
    p_priority,
    p_assignee_id
  );

  IF p_delta < 0 THEN
    UPDATE public.work_item_chart_rollups AS r
    SET item_count = r.item_count + p_delta
    WHERE r.grain_key = v_key;

    DELETE FROM public.work_item_chart_rollups
    WHERE grain_key = v_key
      AND item_count <= 0;

    RETURN;
  END IF;

  INSERT INTO public.work_item_chart_rollups AS r (
    grain_key,
    bucket_date,
    project_id,
    sprint_id,
    status,
    status_category,
    workflow_id,
    state_id,
    type,
    priority,
    assignee_id,
    item_count
  )
  VALUES (
    v_key,
    p_bucket_date,
    p_project_id,
    p_sprint_id,
    p_status,
    p_status_category,
    p_workflow_id,
    p_state_id,
    p_type,
    p_priority,
    p_assignee_id,
    p_delta
  )
  ON CONFLICT (grain_key) DO UPDATE
  SET item_count = r.item_count + EXCLUDED.item_count;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.work_item_chart_hierarchy_rollup_upsert(p_work_item_id uuid, p_parent_id uuid, p_project_id uuid, p_sprint_id uuid, p_bucket_date date, p_status "WorkItemStatus", p_status_category text, p_workflow_id text, p_state_id text, p_type text, p_priority "WorkItemPriority", p_assignee_id uuid, p_story_points integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.work_item_chart_hierarchy_rollups AS r (
    work_item_id,
    parent_id,
    project_id,
    sprint_id,
    bucket_date,
    status,
    status_category,
    workflow_id,
    state_id,
    type,
    priority,
    assignee_id,
    item_count,
    story_points
  )
  VALUES (
    p_work_item_id,
    p_parent_id,
    p_project_id,
    p_sprint_id,
    p_bucket_date,
    p_status,
    p_status_category,
    p_workflow_id,
    p_state_id,
    p_type,
    p_priority,
    p_assignee_id,
    1,
    coalesce(p_story_points, 0)
  )
  ON CONFLICT (work_item_id) DO UPDATE
  SET
    parent_id = EXCLUDED.parent_id,
    project_id = EXCLUDED.project_id,
    sprint_id = EXCLUDED.sprint_id,
    bucket_date = EXCLUDED.bucket_date,
    status = EXCLUDED.status,
    status_category = EXCLUDED.status_category,
    workflow_id = EXCLUDED.workflow_id,
    state_id = EXCLUDED.state_id,
    type = EXCLUDED.type,
    priority = EXCLUDED.priority,
    assignee_id = EXCLUDED.assignee_id,
    item_count = 1,
    story_points = EXCLUDED.story_points;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_work_items_hierarchy_page(p_page integer DEFAULT 1, p_page_size integer DEFAULT 100, p_record_status text DEFAULT 'active'::text, p_project_id uuid DEFAULT NULL::uuid, p_project_ids uuid[] DEFAULT NULL::uuid[], p_sprint_id uuid DEFAULT NULL::uuid, p_sprint_is_null boolean DEFAULT false, p_type text DEFAULT NULL::text, p_assignee_id uuid DEFAULT NULL::uuid, p_labels jsonb DEFAULT NULL::jsonb, p_search text DEFAULT NULL::text, p_focus_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_limit integer := GREATEST(COALESCE(p_page_size, 100), 1);
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_mode text := CASE WHEN v_search IS NULL THEN 'tree' ELSE 'search' END;
  v_total integer := 0;
  v_total_pages integer := 1;
  v_offset integer;
  v_root record;
  v_stack uuid[] := ARRAY[]::uuid[];
  v_anc_stack jsonb[] := ARRAY[]::jsonb[];
  v_cur uuid;
  v_cur_anc jsonb;
  v_child record;
  v_node record;
  v_first_id uuid;
  v_first_root uuid;
  v_page_ids uuid[] := ARRAY[]::uuid[];
  v_table_ids uuid[] := ARRAY[]::uuid[];
  v_panel_ids uuid[] := ARRAY[]::uuid[];
  v_match_ids uuid[] := ARRAY[]::uuid[];
  v_ancestors_by_id jsonb := '{}'::jsonb;
  v_id uuid;
  v_root_id uuid;
  v_anc jsonb;
  v_result jsonb;
BEGIN
  CREATE TEMP TABLE _hi_nodes (
    id uuid PRIMARY KEY,
    parent_id uuid,
    title text NOT NULL,
    type text NOT NULL,
    created_at timestamptz NOT NULL,
    is_match boolean NOT NULL DEFAULT false
  ) ON COMMIT DROP;

  CREATE TEMP TABLE _hi_order (
    ord integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id uuid NOT NULL,
    root_id uuid NOT NULL,
    ancestors jsonb NOT NULL DEFAULT '[]'::jsonb
  ) ON COMMIT DROP;

  -- Candidate / match set under list filters (no parent_id constraint).
  INSERT INTO _hi_nodes (id, parent_id, title, type, created_at, is_match)
  SELECT
    wi.id,
    wi.parent_id,
    wi.title,
    wi.type,
    wi.created_at,
    v_search IS NOT NULL
  FROM public.work_items wi
  WHERE wi.record_status::text = COALESCE(p_record_status, 'active')
    AND (p_project_id IS NULL OR wi.project_id = p_project_id)
    AND (
      p_project_ids IS NULL
      OR cardinality(p_project_ids) = 0
      OR wi.project_id = ANY (p_project_ids)
    )
    AND (
      NOT COALESCE(p_sprint_is_null, false)
      OR wi.sprint_id IS NULL
    )
    AND (p_sprint_id IS NULL OR wi.sprint_id = p_sprint_id)
    AND (p_type IS NULL OR wi.type = p_type)
    AND (p_assignee_id IS NULL OR wi.assignee_id = p_assignee_id)
    AND (
      p_labels IS NULL
      OR jsonb_typeof(p_labels) <> 'array'
      OR jsonb_array_length(p_labels) = 0
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(p_labels) AS lab(label)
        WHERE wi.labels @> jsonb_build_array(lab.label)
      )
    )
    AND (
      v_search IS NULL
      OR wi.title ILIKE (
        '%' || replace(replace(replace(v_search, ',', ''), '(', ''), ')', '') || '%'
      )
      OR wi.labels @> jsonb_build_array(v_search)
    );

  IF v_mode = 'search' THEN
    SELECT COALESCE(array_agg(n.id), ARRAY[]::uuid[])
    INTO v_match_ids
    FROM _hi_nodes n;

    -- Ancestor closure for the results panel (same project / record_status).
    WHILE EXISTS (
      SELECT 1
      FROM _hi_nodes n
      WHERE n.parent_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM _hi_nodes p WHERE p.id = n.parent_id)
        AND EXISTS (
          SELECT 1
          FROM public.work_items wi
          WHERE wi.id = n.parent_id
            AND wi.record_status::text = COALESCE(p_record_status, 'active')
            AND (p_project_id IS NULL OR wi.project_id = p_project_id)
            AND (
              p_project_ids IS NULL
              OR cardinality(p_project_ids) = 0
              OR wi.project_id = ANY (p_project_ids)
            )
        )
    ) LOOP
      INSERT INTO _hi_nodes (id, parent_id, title, type, created_at, is_match)
      SELECT DISTINCT
        wi.id,
        wi.parent_id,
        wi.title,
        wi.type,
        wi.created_at,
        false
      FROM public.work_items wi
      JOIN _hi_nodes n ON n.parent_id = wi.id
      WHERE NOT EXISTS (SELECT 1 FROM _hi_nodes e WHERE e.id = wi.id)
        AND wi.record_status::text = COALESCE(p_record_status, 'active')
        AND (p_project_id IS NULL OR wi.project_id = p_project_id)
        AND (
          p_project_ids IS NULL
          OR cardinality(p_project_ids) = 0
          OR wi.project_id = ANY (p_project_ids)
        );
    END LOOP;
  END IF;

  -- DFS over _hi_nodes (sibling order = created_at DESC, id ASC) matching app walk.
  FOR v_root IN
    SELECT n.*
    FROM _hi_nodes n
    WHERE n.parent_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM _hi_nodes p WHERE p.id = n.parent_id)
    ORDER BY n.created_at DESC, n.id ASC
  LOOP
    v_stack := ARRAY[v_root.id];
    v_anc_stack := ARRAY['[]'::jsonb];

    WHILE coalesce(array_length(v_stack, 1), 0) > 0 LOOP
      v_cur := v_stack[array_upper(v_stack, 1)];
      v_cur_anc := v_anc_stack[array_upper(v_anc_stack, 1)];
      v_stack := v_stack[1 : array_upper(v_stack, 1) - 1];
      v_anc_stack := v_anc_stack[1 : array_upper(v_anc_stack, 1) - 1];

      IF EXISTS (SELECT 1 FROM _hi_order o WHERE o.id = v_cur) THEN
        CONTINUE;
      END IF;

      INSERT INTO _hi_order (id, root_id, ancestors)
      VALUES (v_cur, v_root.id, v_cur_anc);

      SELECT n.* INTO v_node FROM _hi_nodes n WHERE n.id = v_cur;

      -- Push children ASC so LIFO yields created_at DESC.
      FOR v_child IN
        SELECT c.*
        FROM _hi_nodes c
        WHERE c.parent_id = v_cur
        ORDER BY c.created_at ASC, c.id DESC
      LOOP
        v_stack := v_stack || v_child.id;
        v_anc_stack := v_anc_stack || (
          v_cur_anc || jsonb_build_array(
            jsonb_build_object(
              'id', v_node.id,
              'type', v_node.type,
              'title', v_node.title,
              'parent_id', v_node.parent_id
            )
          )
        );
      END LOOP;
    END LOOP;
  END LOOP;

  IF v_mode = 'tree' THEN
    SELECT count(*)::integer INTO v_total FROM _hi_order;
    v_total_pages := GREATEST(1, ceil(v_total::numeric / v_limit::numeric)::integer);
    v_offset := (v_page - 1) * v_limit;

    IF v_offset < v_total THEN
      SELECT o.id, o.root_id
      INTO v_first_id, v_first_root
      FROM _hi_order o
      ORDER BY o.ord
      OFFSET v_offset
      LIMIT 1;

      IF v_first_id IS DISTINCT FROM v_first_root THEN
        SELECT o.id, o.ancestors
        INTO v_id, v_anc
        FROM _hi_order o
        WHERE o.id = v_first_root
        LIMIT 1;
        IF v_id IS NOT NULL THEN
          v_page_ids := v_page_ids || v_id;
          v_ancestors_by_id := v_ancestors_by_id || jsonb_build_object(v_id::text, v_anc);
        END IF;
      END IF;

      FOR v_node IN
        SELECT o.id, o.root_id, o.ancestors
        FROM _hi_order o
        ORDER BY o.ord
        OFFSET v_offset
        LIMIT v_limit
      LOOP
        IF v_node.id = ANY (v_page_ids) THEN
          CONTINUE;
        END IF;
        v_page_ids := v_page_ids || v_node.id;
        v_ancestors_by_id :=
          v_ancestors_by_id || jsonb_build_object(v_node.id::text, v_node.ancestors);
      END LOOP;

      -- Table roots: on-page nodes whose parent is absent from this page.
      SELECT COALESCE(array_agg(x.id), ARRAY[]::uuid[])
      INTO v_table_ids
      FROM (
        SELECT n.id
        FROM _hi_nodes n
        WHERE n.id = ANY (v_page_ids)
          AND (
            n.parent_id IS NULL
            OR NOT (n.parent_id = ANY (v_page_ids))
          )
        ORDER BY array_position(v_page_ids, n.id)
      ) AS x;
    END IF;
  ELSE
    -- Search: flat matches paginated; panel = full closure; optional focus.
    SELECT count(*)::integer INTO v_total
    FROM _hi_nodes n
    WHERE n.is_match;

    SELECT COALESCE(array_agg(n.id ORDER BY n.created_at DESC, n.id ASC), ARRAY[]::uuid[])
    INTO v_match_ids
    FROM _hi_nodes n
    WHERE n.is_match;

    SELECT COALESCE(array_agg(o.id ORDER BY o.ord), ARRAY[]::uuid[])
    INTO v_panel_ids
    FROM _hi_order o;

    IF p_focus_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM _hi_nodes n WHERE n.id = p_focus_id
    ) THEN
      v_table_ids := ARRAY[p_focus_id];
      v_page_ids := ARRAY[p_focus_id] || COALESCE(
        (
          SELECT array_agg(c.id ORDER BY c.created_at DESC, c.id ASC)
          FROM _hi_nodes c
          WHERE c.parent_id = p_focus_id
        ),
        ARRAY[]::uuid[]
      );
      v_total := 1;
      v_total_pages := 1;
      v_page := 1;
    ELSE
      v_total_pages := GREATEST(1, ceil(v_total::numeric / v_limit::numeric)::integer);
      v_page := LEAST(v_page, v_total_pages);
      v_offset := (v_page - 1) * v_limit;
      SELECT COALESCE(
        array_agg(m.id),
        ARRAY[]::uuid[]
      )
      INTO v_table_ids
      FROM (
        SELECT unnest(v_match_ids) AS id
        OFFSET v_offset
        LIMIT v_limit
      ) AS m;
      v_page_ids := v_table_ids;
    END IF;

    FOR v_id IN SELECT unnest(v_page_ids || v_panel_ids)
    LOOP
      SELECT o.ancestors INTO v_anc
      FROM _hi_order o
      WHERE o.id = v_id
      LIMIT 1;
      IF v_anc IS NOT NULL THEN
        v_ancestors_by_id :=
          v_ancestors_by_id || jsonb_build_object(v_id::text, v_anc);
      END IF;
    END LOOP;
  END IF;

  v_result := jsonb_build_object(
    'mode', v_mode,
    'page', v_page,
    'limit', v_limit,
    'total_count', v_total,
    'total_pages', v_total_pages,
    'focus_id', p_focus_id,
    'table_ids', to_jsonb(v_table_ids),
    'page_ids', to_jsonb(v_page_ids),
    'panel_ids', to_jsonb(COALESCE(v_panel_ids, ARRAY[]::uuid[])),
    'match_ids', to_jsonb(COALESCE(v_match_ids, ARRAY[]::uuid[])),
    'ancestors_by_id', v_ancestors_by_id
  );

  DROP TABLE IF EXISTS _hi_order;
  DROP TABLE IF EXISTS _hi_nodes;

  RETURN v_result;
END;
$function$
;

-- 3) Drop enum now that no dependents remain.
DROP TYPE IF EXISTS "WorkItemType";

-- 4) Backfill workflow_config.work_item_types from legacy string[] → catalog defs.
-- Levels follow canonical seed order among enabled keys; orphans get stubs.
DO $$
DECLARE
  seed jsonb := '[
    {"key":"Epic","name":"Epic","description":"Top-level initiative","icon":"layers","level":0},
    {"key":"Feature","name":"Feature","description":"Product capability","icon":"trophy","level":1},
    {"key":"Story","name":"Story","description":"User story / deliverable","icon":"bookmark","level":2},
    {"key":"Task","name":"Task","description":"Standard work unit","icon":"square-check","level":3},
    {"key":"Issue","name":"Issue","description":"Bug or leaf work item","icon":"circle-alert","level":4}
  ]'::jsonb;
  r record;
  cfg jsonb;
  raw jsonb;
  keys text[];
  key text;
  defs jsonb;
  def jsonb;
  lvl int;
  next_level int;
  known text[] := ARRAY['Epic','Feature','Story','Task','Issue'];
  hier jsonb;
  i int;
  parent_key text;
  child_key text;
BEGIN
  FOR r IN
    SELECT p.id, p.workflow_config
    FROM public.projects p
  LOOP
    cfg := COALESCE(r.workflow_config, '{}'::jsonb);
    raw := cfg -> 'work_item_types';

    -- Already an array of objects with key → skip reshape (still merge orphans below).
    IF jsonb_typeof(raw) = 'array'
       AND jsonb_array_length(raw) > 0
       AND jsonb_typeof(raw -> 0) = 'object'
       AND (raw -> 0) ? 'key' THEN
      defs := raw;
    ELSE
      keys := ARRAY[]::text[];
      IF jsonb_typeof(raw) = 'array' THEN
        SELECT COALESCE(array_agg(x), ARRAY[]::text[])
          INTO keys
        FROM (
          SELECT DISTINCT jsonb_array_elements_text(raw) AS x
        ) s
        WHERE x IS NOT NULL AND btrim(x) <> '';
      END IF;

      IF keys IS NULL OR cardinality(keys) = 0 THEN
        SELECT COALESCE(array_agg(DISTINCT wi.type), ARRAY[]::text[])
          INTO keys
        FROM public.work_items wi
        WHERE wi.project_id = r.id;
      END IF;

      IF keys IS NULL OR cardinality(keys) = 0 THEN
        keys := ARRAY['Epic','Story','Task','Issue'];
      END IF;

      defs := '[]'::jsonb;
      lvl := 0;
      FOREACH key IN ARRAY known LOOP
        IF key = ANY (keys) THEN
          SELECT e INTO def
          FROM jsonb_array_elements(seed) AS e
          WHERE e ->> 'key' = key
          LIMIT 1;
          def := jsonb_set(def, '{level}', to_jsonb(lvl), true);
          defs := defs || jsonb_build_array(def);
          lvl := lvl + 1;
        END IF;
      END LOOP;

      FOREACH key IN ARRAY keys LOOP
        IF NOT (key = ANY (known)) THEN
          defs := defs || jsonb_build_array(
            jsonb_build_object(
              'key', key,
              'name', key,
              'description', '',
              'icon', 'square-check',
              'level', lvl
            )
          );
          lvl := lvl + 1;
        END IF;
      END LOOP;
    END IF;

    -- Ensure every distinct work_items.type for this project appears in defs.
    next_level := COALESCE(
      (
        SELECT MAX((d ->> 'level')::int) + 1
        FROM jsonb_array_elements(defs) d
      ),
      0
    );
    FOR key IN
      SELECT DISTINCT wi.type
      FROM public.work_items wi
      WHERE wi.project_id = r.id
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(defs) d
          WHERE d ->> 'key' = wi.type
        )
    LOOP
      defs := defs || jsonb_build_array(
        jsonb_build_object(
          'key', key,
          'name', key,
          'description', '',
          'icon', 'square-check',
          'level', next_level
        )
      );
      next_level := next_level + 1;
    END LOOP;

    -- Derive transitional hierarchy map from levels (linear chain).
    hier := '{}'::jsonb;
    FOR i IN 0 .. GREATEST(jsonb_array_length(defs) - 2, -1) LOOP
      SELECT d ->> 'key' INTO parent_key
      FROM jsonb_array_elements(defs) d
      ORDER BY (d ->> 'level')::int
      OFFSET i LIMIT 1;
      SELECT d ->> 'key' INTO child_key
      FROM jsonb_array_elements(defs) d
      ORDER BY (d ->> 'level')::int
      OFFSET i + 1 LIMIT 1;
      IF parent_key IS NOT NULL AND child_key IS NOT NULL THEN
        hier := hier || jsonb_build_object(parent_key, child_key);
      END IF;
    END LOOP;

    cfg := jsonb_set(cfg, '{work_item_types}', defs, true);
    IF hier <> '{}'::jsonb THEN
      cfg := jsonb_set(cfg, '{hierarchy}', hier, true);
    END IF;

    UPDATE public.projects
    SET workflow_config = cfg
    WHERE id = r.id;
  END LOOP;
END $$;

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
