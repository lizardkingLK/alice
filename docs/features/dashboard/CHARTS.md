# Charts (custom dashboards)

Per-user **chart workspaces** (boards of widgets). `/charts` is a **registry**
(list + tabs); `/charts/[id]` is the board canvas. Layout persists in
**`charts.board_json`** (source of truth). The registry and board are
**API-first** (RSC prefetch + in-memory client state). A cookie stores
last-opened workspace id only — no board JSON in localStorage.
**Tier 1 product** workspace cloud + optional Views indexing + Widget settings
are wired — see [Persistence](#persistence) and
[CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md#tier-1-product-remaining).

## Routes

| Path                             | Behavior                                                              |
| -------------------------------- | --------------------------------------------------------------------- |
| `/charts`                        | Workspace registry (Active / Archived + search + create)              |
| `/charts/[id]`                   | Workspace canvas (widgets + layout); breadcrumb **Charts** → registry |
| `/charts/[id]/widget/[widgetId]` | Same workspace; auto-opens that widget’s config dialog                |
| `/dashboard`                     | Overview — slider of pinned chart workspaces                          |
| `/dashboard?mockOverview=1`      | Escape hatch: legacy mock KPI grid (design reference only)            |

Loading UI: `/charts` uses `RegistrySuspensePage` (no segment `loading.tsx`).
Tab / page / limit / search come from the page `searchParams` promise (same as
Views / Work items) and update with `router.push` / `replace`.
`[id]/loading.tsx` → board pie-grid skeleton.

Registry list and board data are prefetched in RSC (`listOwnedChartWorkspaces` /
`getAccessibleChartWorkspace`). Client mutations update the API, then patch
in-memory state. TanStack Table `data` must stay referentially stable across
unrelated re-renders (memoize slices). Legacy `alice.charts.workspaces.v1:*` /
single-board keys are cleared on visit.

Shell: registry uses `DashboardShell` + `Suspense`; board uses `DashboardShell`
with `contentScrollable={false}`.

## Last-opened vs dashboard pin

| Concern           | Storage / field                                       | Used by                                |
| ----------------- | ----------------------------------------------------- | -------------------------------------- |
| Last opened       | Cookie `alice_charts_last_opened_v1` (chart uuid)     | Preference when opening a board        |
| Show on dashboard | `charts.show_on_dashboard`                            | Which boards appear in Overview slider |
| Dashboard order   | `charts.dashboard_sort_order` (ints ≥ 0, lower first) | Slide order                            |

Do not conflate last-opened with dashboard pin. **`is_overview` was removed** —
pins use `show_on_dashboard` so owners can pin multiple Overview slides.

## Client auth

Expired Supabase access tokens used to surface as generic **Request failed** /
`NEXT_REDIRECT` from client `apiFetch`. Client fetches now refresh once, then
emit a dashboard **Session expired** dialog (sign-in with `next` back to the
board) instead of calling Next `redirect()` from the browser.

## Current UI

| Control      | Behavior                                                                            |
| ------------ | ----------------------------------------------------------------------------------- |
| Search       | Debounced `?search=` via `router.push` (same as Views)                              |
| Tabs         | **Active** / **Archived** only (no Shared tab — Views share is enough)              |
| **+** menu   | **Add workspace** · **Add widget** (catalog)                                        |
| Registry ⋯   | **Edit** (name, description, order, show on dashboard) · Archive / Restore / Delete |
| Workspace ⋯  | **Save option** · Archive / Restore · Delete / Leave                                |
| Board canvas | Grip drag, resize, filter / ⋯ on widgets. Dock disabled                             |
| Fork         | **Fork** left of **+** on shared boards → owned copy                                |

**Share path:** header **Save view** → `/views` **Share**. Charts UI has no
native Share dialog and **no Shared registry tab**. Sharing a chart-backed view
grants **`chart_shares`**; recipients open from Views / inbox, then **Fork**
if they want an owned editable copy.

**Availability:** Live catalog adds: **Chart**, **Nested donut**, **Data over
time** / **Burndown**. Other Browse cards remain **Coming soon**.

### Chart widget (`typeId: chart`)

Live pie/donut/**bar**/column from rollup series API. Fullscreen config: Advanced/Quick filters
(Quick opens on **Project**; **Sprint** after a concrete project; **Assignee**
in the filter popover only; Advanced allows at most one row per column),
settings gear → Widget settings sidebar, layout Chart/Table/Split,
`pieVariant` (`pie` | `donut` | `bar` | `column`), and Labels `labelField`.

Status-grouped table uses board order (New → … → Done). Empty status groups are
hidden; search remounts matching groups expanded.

No Boards section (use project filters).

### Nested donut widget (`typeId: nested-donut`)

Up to three hierarchy rings from `work_item_chart_hierarchy_rollups` via
`GET /analytics/hierarchy-series` (roots → children → grandchildren; optional
`rootWorkItemId` for dig-zoom). Values sidebar: **Count items** or **Story
points** (`measure` on the instance). Every node counts once; child values sit
under their parent ring. Slice focus encodes ring + ids in `focusedSliceKey`
(`h0:…` / `h1:parent:child` / `h2:…`). **Dig:** client `digPath` +
`rootWorkItemId` re-roots rings; diggable slices dig in Chart mode, leaves and
Table/Split focus drilldown. See
[CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md#nested-donut-shipped).

### Widget settings sidebar

| Section                      | Status today                                     | Notes                                                                     |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| Chart type                   | Pie / Donut / Bar / **Column** (unique only)     | Hidden for nested-donut                                                   |
| Labels                       | Live API-backed columns                          | Hidden for nested-donut (hierarchy rings are fixed)                       |
| Values                       | Count items; nested also **Story points**        | Flat Chart stays count-only; nested uses Count / Sum                      |
| Customize                    | % vs count, sort, empty slices, **slice colors** | Theme swatches (`chart-1`…`8`); reset on Labels change                    |
| Groups                       | Coming soon (deferred)                           | Table already hides empty status groups                                   |
| Choose which columns to show | Drilldown column visibility                      | Default: Task/Owner/Status/State/Type/Priority; Project + Sprint optional |

Clicking a Labels slice on the board or in fullscreen opens Split and scopes
the table (`focusedSliceKey`). Changing Labels clears the slice focus.

## Persistence

### Client

- In-memory React state after RSC prefetch (registry list + board).
- Cookie `alice_charts_last_opened_v1` for last-opened chart id only.
- On visit, clear legacy keys: `alice.charts.workspaces.v1:*`,
  `alice.charts.board.layout.v1`, `alice.charts.board.instances.v1`.

Empty accounts stay empty — `/charts` registry shows a create CTA (no
auto-default workspace). Deleting the last workspace returns to that empty
registry state.

### Server (source of truth)

Table **`charts`**:

- `id`, `owner_id`, `title`, `description?`
- `board_json` (widgets + layout) — **source of truth for board data**
  - Widget instances may carry per-instance `title?` and **`description?`**
  - Optional board-level **`scope: { projectId, sprintId } | null`** —
    set at workspace create when **Lock to project and sprint** is checked.
    Scoped boards hide workspace Filter and widget project/sprint controls;
    new Chart / burndown widgets inherit `filters` from that scope. Owners may
    **Mark as non-scoped** (`scope: null`) but cannot change the locked pair.
    Mixed boards keep Filter as the **active** insert selection; burndown
    prompts only when Filter lacks a concrete project/sprint. Legacy
    per-widget `scopeLocked` is ignored for lock UX (stripped on mark
    non-scoped). Card chrome shows **Project · Sprint**
    (`BurndownScopeLabels`) for chart and burndown.
- `show_on_dashboard` + `dashboard_sort_order`
- `status`, audit columns

Sharing:

- **`chart_shares`** — recipient ACL on the chart row (board access).
- **Views** — users opt in with header **Save view**. Saving `/charts/[id]`
  stamps `resource_kind=chart` + `resource_id`. Sharing that view from
  `/views` upserts `saved_view_shares` **and** `chart_shares`. Leaving the
  view share also deletes the matching chart share.
- Chart meta save should ideally call **`upsertChartBookmark`** so Views
  bookmarks stay titled/described (**planned**).
- Do **not** store board JSON inside `saved_views.search`.
- **Fork:** `POST /api/charts/:id/fork` clones `board_json` + title/description
  under the viewer as owner (requires share access; not for owners).

Notification type: `view_shared` for Views shares (inbox). Low-level
`chart_shared` remains available if the charts share API is called directly.

**Workspace lifecycle (web):** Archive (active) / Restore (archived) from the
workspace **⋯** menu; **Delete** always available for owned charts (confirm
dialog); **Leave** when the board was opened with shared ACL. Empty store →
`/charts` create CTA.

## Data strategy (widget payloads)

**Tier 1 analytics (shipped):** categorical pie series from
`work_item_chart_rollups` (trigger-maintained counts). Slice → table uses
**paginated** live `work_items` via drilldown. Measure: **`item_count` only**.

### Hierarchy and sprint charts

Categorical pies (Chart widgets, sprint report **Status Distribution**) count
**each work item once** at its stored `sprint_id`. Parent and child in the same
sprint both appear in totals — same as Jira-style flat sprint membership, not a
nested epic rollup.

Use **Labels → Type** on Chart when you want flat type slices. For parent/child
rings, add catalog **Nested donut** (`work_item_chart_hierarchy_rollups`,
Count or Story points). See
[CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md#nested-donut-shipped).

**API:** `GET /api/v1/charts/analytics/series` and `…/analytics/drilldown` —
(plus `…/hierarchy-series` / `…/hierarchy-drilldown` for nested-donut) —
see [CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md#apis).

**Web:** Chart widgets load series/drilldown from that API. **Project** filter
supports **All projects** or a single project. Optional **sprint** from
workspace defaults. Labels → Columns: Project, Owner, Status, Type, Priority
(Group / Name / Due date not on the rollup yet).

**Defaults:** Filter dialog (**Shift+F**) with **Set as default** on Project /
Sprint — same storage as Board / Work items / Backlog. Seeds new Chart widgets.
Saving defaults seeds **project** (and **sprint** when set) onto newly inserted
Chart widgets.

**Drilldown table:** Widget settings → **Choose which columns to show** includes
**State** and **Actions** (both on by default). **State** resolves the workflow
state label from the work item’s `state` JSON + project `workflow_config`
(legacy Status label when no workflow). Row **⋯** offers **Open**
(`/work-items/[id]`) and **Edit** (preferred `WorkItemFormDialog`). After a
successful edit, the client clears the in-memory series/drilldown caches
(`invalidateChartAnalyticsCaches`) and calls `router.refresh()` so pie + table
refetch without a full page reload.

### Burndown widget (living)

Catalog **Data over time** and Delivery **Burndown** both mean sprint burndown
(alias → one renderer). Series from `GET /api/sprints/:id/burndown`, which
prefers `sprint_burndown_rollups` (trigger-maintained) and falls back to live
`computeBurndown`. Widget shows **Project · Sprint** labels top-right and
reuses board filter drafts for project/sprint. Shared UI:
`BurndownLineChart` / `BurndownScopeLabels`.

Checklist:
[Charts Burndown widget](./CHARTS_AGGREGATION.md#charts-burndown-widget-next-implementation).

Tier 2/3 (Neon read model, apps rename): [CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md).

## Save option, descriptions, Alice suggest

Shipped:

1. **Save option** dialogs (workspace create/save + widget ⋯): **Name** +
   **Description**. Menu label **Save option**.
2. Title row: info tooltip next to workspace / widget name. Empty description
   falls back to the default name (`Tasks by status`, `Sprint burndown`, or
   workspace title).
3. Top-right **Saving…** (spinner then text) for **every** board sync
   (`syncChartWorkspaceToApi`), including drag, filters, and Save option.
4. Alice **one-shot** suggest (no chat conversation): button beside description
   → `POST /api/v1/chat/generate-chart-description` with compact widget or
   workspace context → fills the draft for review before Save.

## Dashboard Overview = productivity + chart slider

Default `/dashboard` supports two modes (Customize dialog; prefs in
localStorage + cookie):

1. **Productivity** — draggable grid (`react-grid-layout`) with live My Work
   KPIs, projects list, Alice chat widget, docs (fullscreen), and pomodoro.
   Default when no boards are pinned.
2. **Chart workspaces** — horizontal slider of boards with
   `show_on_dashboard`, ordered by `dashboard_sort_order`. Always available;
   empty state shows a pin tip. Single pin omits tabs/chevrons.

**Customize** opens a dialog: mode cards + productivity widget toggles + link to
`/charts/[id]` for the active slide (charts mode).

### Registry Edit (owned)

Row **Edit** opens: Name, Description (+ Alice), Order (positive), **Show on
dashboard**. No Shared registry tab — Views share remains the ACL path.

### Overview slide chrome (readonly-enhanced)

| Allowed                        | Hidden / disabled                                  |
| ------------------------------ | -------------------------------------------------- |
| Drag / resize (owned slides)   | Filters on Chart + Burndown widgets                |
| Fullscreen + Export            | Widget settings, Save option, duplicate, delete    |
| Drilldown + open `/work-items` | Shared slides: layout locked (sync already no-ops) |

Cache visited slides (keep-alive) so sliding back does not refetch. Full board
edit via Customize → Customize active board → `/charts/[id]`.

### Workspace chrome

- **All workspaces** button removed; breadcrumb **Charts** → `/charts`.
- **Fork** left of **+** on shared boards.

### Delivery order

1. Descriptions / Save option / Saving… / Alice — done
2. Schema flags + registry Edit + drop `is_overview` — done
3. Dashboard slider + readonly chrome — done
4. Fork + chrome cleanup — done
5. Tests + user-guide sync — done

## Preserved overview mock → future widgets

**Default Overview** becomes the workspace slider. Keep the legacy mock grid
behind an explicit query flag for design reference:

| URL                         | Renders                          |
| --------------------------- | -------------------------------- |
| `/dashboard`                | Chart workspace slider (default) |
| `/dashboard?mockOverview=1` | Existing mock KPI / charts grid  |

When Numbers/KPI, velocity, and activity catalog widgets ship, **delete** the
`mockOverview` branch and mock sources in one cleanup PR.

### Mock inventory (what `mockOverview=1` preserves)

Sources: `apps/web/app/dashboard/_components/dashboard-mock-data.ts`,
`dashboard-widgets.tsx`, layout key `alice.dashboard.overview.layout.v1`.

| Widget id                                                 | Live today? | UI to preserve for future catalog                          |
| --------------------------------------------------------- | ----------- | ---------------------------------------------------------- |
| `open-issues`, `in-progress`, `completed`, `team-members` | Mock        | Stat card: subtitle + large value + delta (`+2 this week`) |
| `status-mix`                                              | Mock        | Donut (live Chart widget already covers this)              |
| `sprint-burndown`                                         | **Live**    | Burndown + scope labels (already on Charts)                |
| `velocity`                                                | Mock        | Team velocity bar (`ChartViewport`)                        |
| `recent-activity`                                         | Mock        | Scrollable **list** feed (not a data table)                |

Default mock grid: row0 = 4× KPI; row1 = status-mix + burndown; row2 = velocity

- activity. Only burndown is live on the mock overview today.

### Future catalog mapping (Tier-next; not blocking slider)

| Future widget           | Reuse chrome from                       |
| ----------------------- | --------------------------------------- |
| Numbers / KPI           | `StatWidget` (subtitle + value + delta) |
| Column / Bar (velocity) | `VelocityWidget`                        |
| List (activity)         | `ActivityWidget` list rows              |
| Chart / Burndown        | Already live on `/charts`               |

Until those ship, users pin Chart + Burndown workspaces with **Show on
dashboard**.

## Non-goals (near term)

- Public/anonymous chart links
- Putting layout into `saved_views.search`
- Nested widget route as the only configuration UI
- Sharing Favorites
- Native Charts Share dialog / Shared-with-me registry tab (Views share is enough)
- Neon / Render / Upstash wiring (Tier 2+)
- Other Coming soon catalog types (Numbers, Battery, Gantt, …)
- Reintroducing `is_overview` alongside `show_on_dashboard`

## Related

- Aggregation + burndown rollup plan: [CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md)
- Sprint burndown domain: [BURNDOWN_CHART.md](../sprints/BURNDOWN_CHART.md)
- User guide: `docs/user-guide/navigation/charts.md`,
  `docs/user-guide/navigation/dashboard-overview.md`
- Views sharing model: `docs/features/views/FAVORITES_AND_VIEWS.md`
