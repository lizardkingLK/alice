-- Hierarchy list page: one RPC for DFS forest pagination (browse) or search
-- hits + ancestor panel. Invoked from RSC via supabase.rpc (SECURITY INVOKER).
-- Returns jsonb metadata (ids + ancestors); the app hydrates list rows by id.

CREATE OR REPLACE FUNCTION public.get_work_items_hierarchy_page(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 100,
  p_record_status text DEFAULT 'active',
  p_project_id uuid DEFAULT NULL,
  p_project_ids uuid[] DEFAULT NULL,
  p_sprint_id uuid DEFAULT NULL,
  p_sprint_is_null boolean DEFAULT false,
  p_type "WorkItemType" DEFAULT NULL,
  p_assignee_id uuid DEFAULT NULL,
  p_labels jsonb DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_focus_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
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
    type "WorkItemType" NOT NULL,
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
$$;

REVOKE ALL ON FUNCTION public.get_work_items_hierarchy_page(
  integer, integer, text, uuid, uuid[], uuid, boolean, "WorkItemType", uuid, jsonb, text, uuid
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_work_items_hierarchy_page(
  integer, integer, text, uuid, uuid[], uuid, boolean, "WorkItemType", uuid, jsonb, text, uuid
) TO postgres, anon, authenticated, service_role;
