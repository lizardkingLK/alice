# Charts aggregation (work-item series)

Status: **Tier 1 analytics + product shipped** — categorical rollup + series/drilldown
API + live Chart widget pie/table; cloud workspaces + Views `resource_kind`
bookmarks + Widget settings. **Next:** Charts **Burndown** widget on a dedicated
time-series rollup (implementation steps below). Nested donut and other catalog
types stay design-only until open questions are locked.
Tier 2/3 remain design-only (see below).

Replaces in-memory chart mocks with precomputed **rollup** statistics and
paginated drilldown. Heavy joins per pie slice (or per burndown day) are out of
scope for widget reads.

Related:

- Product UI: [CHARTS.md](./CHARTS.md)
- Sprint burndown domain (algorithm, dashboard API): [BURNDOWN_CHART.md](../sprints/BURNDOWN_CHART.md)
- DB access: [DATABASE.md](../../guides/DATABASE.md)
- Performance: [PERFORMANCE.md](../../guides/PERFORMANCE.md)
- User guide: [charts.md](../../user-guide/navigation/charts.md)
- Views indexing plan: [FAVORITES_AND_VIEWS.md](../views/FAVORITES_AND_VIEWS.md#chart-workspaces)

---

## Naming

| Term                                       | Meaning                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Materialized statistics (product language) | Precomputed counts / series for cheap chart reads                                                |
| Postgres `MATERIALIZED VIEW`               | **Not used** — cannot be incrementally updated by triggers                                       |
| **Rollup table**                           | Normal table maintained by `AFTER` triggers (work items, worklogs, …)                            |
| **Categorical rollup**                     | `work_item_chart_rollups` — pie/bar `item_count` by dimensions                                   |
| **Burndown rollup**                        | Dedicated time-series table (sprint × day) — remaining / spent for Charts + future read replicas |

---

## Tiers

| Tier  | Scope                                                                                                                                                | Status                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **1** | Same Supabase DB: categorical rollup + series/drilldown; Chart widget; cloud workspaces + Views; **Burndown widget + burndown rollup (in progress)** | **Categorical done; burndown next** |
| **2** | Lean `work_items` read model on **Neon**; **Render `reader`**; **Upstash** queue; Express **post-commit** publisher; **Pusher** auth as streamer     | Later                               |
| **3** | Whole-app reads on Neon; **apps rename** first; separate architecture doc                                                                            | Later                               |

### Tier 1 locks

- Measure: **`item_count` only** (story points in a later migration)
- Bucket: `(created_at)::date`
- One shared dimensional rollup for categorical charts (pie now; bar later via `GROUP BY`)
- Slice → table: live `work_items`, paginated (not ID lists in the rollup)
- Board JSON lives on **`charts.board_json`** — never inside `saved_views.search`
- Chart listing in Views uses typed `saved_views.resource_kind` / `resource_id` (see remaining steps)

### Tier 2 locks

- Browser → Render **reader** → Neon
- Enqueue: Express **post-commit** publisher (generic interceptor) → Upstash
- Neon holds a **lean** `work_items` projection (+ chart reads), not a full row mirror of the whole schema
- Queue **consumer on `worker`**; **reader** HTTP-only
- **Streamer** = Pusher auth/BFF until outgrown
- Cutover: dual-run + feature flag

### Tier 3 locks

- Whole-app Neon reads
- Rename deployables **before** that migration (see below)
- Own follow-up documentation when started; this file only outlines the target

---

## Future apps rename (before Tier 3)

| Today      | Target     | Role                                                                |
| ---------- | ---------- | ------------------------------------------------------------------- |
| `apps/web` | `client`   | UI (Vercel)                                                         |
| `apps/api` | `writer`   | Mutations + post-commit publish (Vercel)                            |
| —          | `reader`   | Neon-backed read HTTP API (Render)                                  |
| —          | `streamer` | Realtime gateway (Pusher auth / façade)                             |
| —          | `worker`   | Long-running jobs, queue consumers, heavy crons (Render or similar) |

Tier 2 may add `reader` / `worker` without renaming `web` / `api`. Rename
`client` / `writer` just before Tier 3.

---

## Tier 1 data model

### Table `work_item_chart_rollups`

| Column            | Role                                     |
| ----------------- | ---------------------------------------- |
| `bucket_date`     | `date` from `created_at`                 |
| `project_id`      | uuid                                     |
| `sprint_id`       | uuid nullable                            |
| `status`          | legacy work item status enum             |
| `status_category` | workflow category (`draft` / `todo` / …) |
| `workflow_id`     | current workflow id                      |
| `state_id`        | current workflow state id                |
| `type`            | work item type                           |
| `priority`        | work item priority                       |
| `assignee_id`     | uuid nullable                            |
| `item_count`      | int                                      |

- Unique / PK on full grain (`grain_key` includes category + workflow + state)
- Secondary indexes: `(project_id, bucket_date)`, `(project_id, status_category)`, `(project_id, state_id)`
- Series label fields: `status`, `category`, `state` (State requires a single project), `owner`, `board`, `type`, `priority`
- `work_items` mirrors `status_category` / `state_id` / `state_workflow_id` (BEFORE trigger) for drilldown

### Triggers

`AFTER INSERT OR UPDATE OR DELETE` on `work_items` (respect `record_status`):

- INSERT → `+1`
- DELETE / leave active → `-1`
- Grain field change → `-old` + `+new`

No HTTP or queues inside the trigger.

**Project hard-delete:** `projects` → `work_items` and `work_item_chart_rollups`
both use `ON DELETE CASCADE`. Cascade-deleting work items still fires the
`AFTER DELETE` rollup trigger. Negative deltas must **only UPDATE/DELETE**
existing rollup rows — never `INSERT…ON CONFLICT` — or Postgres recreates a
rollup row for the dying `project_id` and raises
`work_item_chart_rollups_project_id_fkey`. Fix migration:
`fix_chart_rollup_delta_on_project_cascade`.

### Indexes on `work_items`

- `(assignee_id)`
- `(sprint_id)`
- `(project_id, status)`
- Time column as needed for drilldown date filters (`created_at`)

### APIs

| Method | Path                                 | Source                                                                                                 |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/v1/charts/analytics/series`    | `SUM(item_count) … GROUP BY labelField` on `work_item_chart_rollups` + optional `from`/`to`/`sprintId` |
| `GET`  | `/api/v1/charts/analytics/drilldown` | Paginated active `work_items` with the same filters + `sliceKey`                                       |

**Query (series):**

| Param         | Required | Notes                                                                                     |
| ------------- | -------- | ----------------------------------------------------------------------------------------- |
| `projectId`   | no       | UUID for one project; omit for **all accessible** projects (Charts “All projects” filter) |
| `labelField`  | no       | `status` (default) \| `owner` \| `board` \| `type` \| `priority`                          |
| `from` / `to` | no       | `YYYY-MM-DD` on rollup `bucket_date`                                                      |
| `sprintId`    | no       | UUID                                                                                      |

**Query (drilldown):** same filters plus `sliceKey` (empty string = NULL, e.g. unassigned), `page` (default 1), `limit` (default 20, max 100).

`owner` → `assignee_id`, `board` → `project_id`. UI fields not on the rollup (`group`, `name`, `dueDate`) are rejected.

Auth/RBAC: same project access as board / work items (`listAccessibleProjectIds`).

Also mounted at `/api/charts/…` (legacy alias).

---

## Tier 1 implementation steps

### Analytics (done)

Steps 1–4 below are **done**. Kept as a historical checklist for the rollup /
live pie path.

#### Step 1 — Schema: indexes + rollup + backfill + triggers ✅

**Migration:** `packages/db/prisma/migrations/add_work_item_chart_rollups/`

**Docs:** this file; [CHARTS.md](./CHARTS.md) data strategy.

**Code:**

1. Prisma model `work_item_chart_rollups` + migration SQL (indexes, table, helpers, trigger, backfill)
2. Indexes on `work_items` (assignee, sprint, project+status, created_at)
3. Apply with `pnpm db migrate:deploy` (requires `DIRECT_URL`)
4. `pnpm db generate` / `generate:client` as usual

**Verify:** insert/update/delete a work item in dev; rollup counts move correctly.

#### Step 2 — API: series + drilldown ✅

**Docs:** routes documented under [APIs](#apis) above.

**Code:**

1. `GET /api/v1/charts/analytics/series` + `…/drilldown` (registered before `/:id`)
2. Types/schemas in `@repo/types` (`charts-analytics.ts`)
3. Repository groupBy on rollups + paginated WI drilldown; ACL via `listAccessibleProjectIds`
4. Unit tests under `apps/api/tests/charts/`

**Verify:** authenticated HTTP against a project with known WI distribution.

#### Step 3 — Web: replace mocks ✅

**Docs:** [CHARTS.md](./CHARTS.md) widget section (mock → live); user guide Labels/filters.

**Code:**

1. Client `fetchChartSeries` / `fetchChartDrilldown` + `useChartWidgetAnalytics`
2. Chart widget pie from series; slice click → drilldown into grouped table
3. Chart widget no longer uses `CHARTS_SAMPLE_WORK_ITEMS` (sample helpers remain for unit tests / stubs)
4. Project filter supports All projects or a concrete project; Labels columns limited to API-backed fields
5. Web tests: `apps/web/tests/charts/charts-analytics.ui.test.ts`

**Verify:** `/charts/[id]` pie matches board/work-item reality for a project filter.

#### Step 4 — Analytics docs polish + sync ✅

1. Exact API paths, migration folder name
2. [CHARTS.md](./CHARTS.md) + [README.md](./README.md) links
3. User guide live Labels / filters
4. `pnpm --filter web docs:sync`

### Tier 1 product (complete)

Workspace cloud wiring and Widget settings are **done**. Boards hydrate from the
charts API (localStorage is a cache). Steps 5–6 below are the shipped checklist.

#### Step 5 — Workspace API + Views index ✅

**Goal:** `charts` is the board source of truth; `/views` and Charts workspace
lists index chart entries without scanning pathnames.

1. Extend `saved_views` with `resource_kind` (`page` \| `chart`) and nullable
   `resource_id` (chart uuid when kind=`chart`)
2. Indexes: `(owner_id, status, resource_kind)`; partial unique one active chart
   bookmark per owner per `resource_id`
3. Views indexing is **opt-in**: header **Save view** on `/charts/{id}` stamps
   `resource_kind=chart` + `resource_id` (chart CRUD does not auto-upsert)
4. Web: prefetch owned list / board from charts API in RSC; client holds
   in-memory state only (no board JSON in localStorage); last-opened cookie
5. Keep board JSON on `charts.board_json` only; `chart_shares` for board ACL
   (granted when sharing a chart-backed view from Views); `saved_view_shares`
   for the Views bookmark entry
6. Web lifecycle: Charts **registry** at `/charts` (Active / Archived only);
   Archive / Restore / Delete / Leave via row or board **⋯**; empty Mine tab
   shows create CTA (no auto-default workspace); share via Save view → Views

**Docs:** [CHARTS.md](./CHARTS.md#persistence), [FAVORITES_AND_VIEWS.md](../views/FAVORITES_AND_VIEWS.md#chart-workspaces).

#### Step 6 — Widget settings sidebar ✅

**Goal:** Settings collapsibles are real (or honestly Coming soon), not
`pointer-events-none` stubs.

| Section                      | Tier 1 product target                                                            |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Chart type                   | Keep Pie/Donut; other types Coming soon                                          |
| Labels                       | Keep API-backed columns; hide Group / Name / Due date until rollup supports them |
| Values                       | Measure = `item_count` only; hide or disable Sum/Average/… beyond count          |
| Customize                    | Wire show as % vs count, sort, show empty slices; persist on widget instance     |
| Groups                       | **Deferred** — empty status groups already hidden in the table                   |
| Choose which columns to show | Wire drilldown table column visibility; persist on widget                        |

**Docs:** [CHARTS.md](./CHARTS.md#widget-settings-sidebar).

### Code map (Tier 1 analytics)

| Layer                  | Path                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| Migration              | `packages/db/prisma/migrations/add_work_item_chart_rollups/`                                       |
| Prisma model           | `work_item_chart_rollups` in `packages/db/prisma/schema.prisma`                                    |
| API types              | `packages/types/src/api/v1/charts-analytics.ts`                                                    |
| API route/service/repo | `apps/api/src/routes/api/charts/`                                                                  |
| API tests              | `apps/api/tests/charts/`                                                                           |
| Web client + hook      | `apps/web/app/charts/_services/charts.analytics.client.ts`, `_hooks/use-chart-widget-analytics.ts` |
| Web helpers / tests    | `apps/web/app/charts/_helpers/charts-analytics.ui.ts`, `apps/web/tests/charts/`                    |

---

## Tier 2 / 3 (not in current implementation)

```text
writer post-commit → Upstash → worker apply → Neon
client → reader (JWT + ACL) → Neon
worker/reader → Pusher → client invalidate
```

Whole-app Neon reads and the apps rename are **Tier 3**; expand in a dedicated
architecture doc when that program starts.

---

## Hierarchy and future chart types

### Today (Tier 1)

Rollup grain is one row per work item (`item_count` += 1). Filters include
`sprint_id`, `type`, `status`, etc. Charts do **not** collapse children under
parents or exclude subtasks when a parent is in the same sprint.

That is intentional for parity with backlog/sprint planning: children inherit the
parent sprint (see work-items sprint inheritance). A sprint pie can show both an
Epic and its Tasks as separate slices when grouped by **status** or **type**.

### Multilevel / nested donut (proposal)

A sunburst-style chart (inner ring + outer ring), as in product explorations,
could show:

| Ring  | Example grouping                          |
| ----- | ----------------------------------------- |
| Inner | Root work items in scope (e.g. Epics)     |
| Outer | Direct children per inner slice (Stories) |

**Requirements before shipping:**

- New analytics dimension (`hierarchy_level` or paired parent/child series), not
  the flat rollup alone — likely a **second** hierarchy rollup table (same
  trigger-maintained pattern as categorical + burndown)
- Documented measure rules (count items vs sum story points; no double count)
- Drilldown that respects parent–child links
- UI behind chart type **Nested donut** with depth cap (likely 2 levels)

Until then, use **Type** / **State** labels on the existing pie or donut.

**Do not implement nested donut until [open questions](#open-questions-before-nested--other-types) are answered.**

---

## Charts Burndown widget (next implementation)

**Goal:** Unlock catalog **Data over time** and Delivery **Burndown** as the
same burndown experience on `/charts` boards, backed by a **dedicated burndown
rollup** (not `work_item_chart_rollups`), while reusing existing widget chrome
and filter persistence on `charts.board_json`.

Dashboard overview already ships a live burndown via `computeBurndown` + sprint
embed / `GET /api/sprints/:id/burndown`
([BURNDOWN_CHART.md](../sprints/BURNDOWN_CHART.md)). Charts should converge on
the **same series semantics**, but **read from rollup** so widget loads stay
cheap and syncable when we later move chart reads to a replica / reader service
(Tier 2).

### Why a rollup (scaling agreement)

| Concern                        | Live join (overview today)                          | Burndown rollup                                         |
| ------------------------------ | --------------------------------------------------- | ------------------------------------------------------- |
| Widget fan-out                 | N widgets × sprint items × worklogs                 | One indexed read per sprint                             |
| Future Neon / reader           | Must replicate WI + worklogs or recompute on writer | Sync **small** rollup rows only                         |
| Function split (charts reader) | Couples reader to OLTP grain                        | Charts domain owns its statistics tables                |
| Correctness                    | Always fresh                                        | Trigger-maintained; same algorithm as `computeBurndown` |

**Agree:** purpose-built rollups (categorical today, burndown next, hierarchy
later) are the scaling path. Do **not** overload `work_item_chart_rollups` with
remaining/ideal — different grain and measure. Do **not** invent Postgres
`MATERIALIZED VIEW` refresh for this.

Ideal line can stay derived at read time from `estimated_total` + sprint dates
(cheap). Remaining / spent by day should be precomputed (or spent cumulative
stored so remaining = estimated − spent).

### Catalog mapping

| Catalog id       | Category       | Behavior                                            |
| ---------------- | -------------- | --------------------------------------------------- |
| `data-over-time` | Staying on Top | **Alias** → burndown widget (not created-over-time) |
| `burndown`       | Delivery       | Canonical burndown widget                           |

Both set `available: true` and insert the same renderer / config shape. Product
copy may still say “Data over time” in quick-add; series meaning is sprint
burndown.

### Widget UX

- Reuse Chart card shell (⋯ menu, layout, fullscreen, filter affordance).
- **Context labels (required):** top-right of the widget header show **Project**
  and **Sprint** names so scope is visible without opening filters. Dashboard
  overview already ships this via shared `BurndownScopeLabels`
  (`apps/web/components/burndown-scope-labels.tsx`) — Charts should reuse it.
- Sprint selection via existing widget filters / settings (required for series).
- Seed project + sprint from workspace board defaults when inserting a new
  burndown widget (same pattern as Chart widgets).
- Chart: remaining vs ideal over sprint dates (reuse Recharts pattern from
  overview; prefer a shared presentational component later).

### Proposed table `sprint_burndown_rollups`

Working name — finalize in migration.

| Column            | Role                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `sprint_id`       | uuid (PK with `bucket_date`)                                                                             |
| `bucket_date`     | `date` — one row per calendar day in `[start_date, end_date]`                                            |
| `project_id`      | uuid — denormalized for ACL / project filter / replica routing                                           |
| `estimated_total` | numeric — Σ story points in sprint (current-scope semantics, same as `computeBurndown`)                  |
| `spent`           | numeric — cumulative finished through that day (worklogs hours or done-points fallback)                  |
| `remaining`       | numeric — `max(0, estimated_total − spent)` for past/closed days; null for future days on active sprints |

**Indexes:** `(project_id, sprint_id)`, `(sprint_id, bucket_date)`.

**Maintenance (triggers / functions):**

- On `work_item_worklogs` insert/update/delete (active rows) → rebuild or delta
  affected sprint days.
- On `work_items` changes that affect scope or fallback remaining (`sprint_id`,
  `story_points`, `done_at`, `record_status`) → rebuild that sprint’s series.
- On `sprints` date/status changes → rebuild date range.

Rebuild may re-run the shared TypeScript algorithm in a worker later; for Tier 1
on Supabase, prefer **SQL functions** mirroring `computeBurndown` or a single
“rebuild sprint” function invoked from triggers (keep one source of truth
documented next to `packages/types/src/sprint-burndown.ts`).

**Backfill:** for each active/closed sprint with dates, populate daily rows once
at migration time.

### APIs

| Method | Path (proposal)                     | Source                                                                           |
| ------ | ----------------------------------- | -------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/charts/analytics/burndown` | Read `sprint_burndown_rollups` + sprint meta                                     |
| Keep   | `GET /api/sprints/:id/burndown`     | Live compute for dashboard / migration parity; optionally switch to rollup later |

**Query:** `sprintId` (required), optional `projectId` for ACL check alignment.

**Response:** reuse `SprintBurndownPayload` (`sprint`, `estimatedTotal`,
`series[{ date, remaining, ideal }]`) so web clients share one type. Ideal may
be filled in the service from dates + estimated total if not stored.

### Implementation steps (burndown only)

#### Step B0 — Web live widget (non-rollup) ✅

1. Mark `burndown` + `data-over-time` `available: true`; shared renderer via
   `isBurndownWidgetType`
2. Widget card: `GET /api/sprints/:id/burndown`; **Project · Sprint** labels;
   filters popover for project/sprint; seed from board defaults
3. Shared `BurndownLineChart` + `BurndownScopeLabels` (Overview + Charts)
4. User guide + [CHARTS.md](./CHARTS.md); web tests for catalog/layout helpers

#### Step B1 — Schema: burndown rollup + triggers + backfill ✅ (migrate pending in each env)

1. Prisma model `sprint_burndown_rollups` + migration
   `packages/db/prisma/migrations/add_sprint_burndown_rollups/`
2. SQL `rebuild_sprint_burndown_rollups(uuid)` + triggers on work_items,
   work_item_worklogs, sprints; backfill planned/active/closed
3. Run `pnpm --filter @repo/db migrate:deploy` and `generate` / `generate:client`
   per environment

#### Step B2 — API: prefer rollup on existing burndown route ✅

1. `GET /api/sprints/:id/burndown` reads rollup when rows exist; else live
   `computeBurndown` and best-effort rebuild
2. Shared helpers: `seriesFromBurndownRollupRows` / `computeBurndownIdeal` in
   `@repo/types`
3. Charts widgets already call this route via `fetchSprintBurndown`
4. Optional later: dedicated `GET /api/v1/charts/analytics/burndown` alias

#### Step B3 — Web: living widget already on burndown route ✅

1. Charts burndown / data-over-time widgets use `fetchSprintBurndown`
2. Empty states unchanged; Overview can adopt rollup via same service later

#### Step B4 — Optional convergence

1. Point dashboard reader at rollup **or** keep live compute for overview
   (document choice when implementing)

### Out of scope for Steps B1–B4

- Nested donut / hierarchy rollup
- Numbers, Battery, Gantt, and other Coming soon catalog entries
- Capacity-aware ideal line (see BURNDOWN_CHART phase 5)
- Story points measure on categorical rollup
- Switching overview off live compute (only if B4 chooses it)

---

## Open questions (before nested / other types)

Resolve before starting nested donut or non-burndown catalog types:

1. **Nested as `pieVariant` on Chart vs new catalog `typeId`?**
2. **Nested measure for v1:** `item_count` only (Tier 1 lock) or story points?
3. **Counting rule:** count every node once vs leaves only; how do inner-ring
   totals relate to outer (sum vs distinct parents)?
4. **Hierarchy rollup grain:** parent_id + child dimensions vs
   `hierarchy_level` rows — one table or two?
5. **Data over time:** locked as burndown alias for this plan — confirm we will
   **not** ship “created over time” under that catalog id without a rename.
6. **Dashboard overview:** stay on live `computeBurndown` permanently, or move
   to `sprint_burndown_rollups` after Charts ships?

---

## Non-goals (current Tier 1 window)

- Neon / Render / Upstash / apps rename (Tier 2+)
- Multilevel / nested donut series until open questions are locked
- Story points on the **categorical** rollup
- Postgres `REFRESH MATERIALIZED VIEW`
- Overloading `work_item_chart_rollups` with burndown remaining/ideal
- Shipping Numbers / Battery / Gantt / nested in the same burndown steps
- Storing board JSON inside `saved_views.search` (use `charts.board_json` +
  typed `resource_*` on Views instead)
