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

| Path                             | Behavior                                                               |
| -------------------------------- | ---------------------------------------------------------------------- |
| `/charts`                        | Workspace registry (Active / Archived + search + create)               |
| `/charts/[id]`                   | Workspace canvas (widgets + layout); breadcrumb **Charts** → registry  |
| `/charts/[id]/widget/[widgetId]` | Same workspace; auto-opens that widget’s config dialog                 |
| `/dashboard`                     | Overview — **planned:** slider of pinned chart workspaces (see below)  |
| `/dashboard?mockOverview=1`      | **Planned escape hatch:** legacy mock KPI grid (design reference only) |

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

| Concern           | Storage / field                                                         | Used by                                |
| ----------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| Last opened       | Cookie `alice_charts_last_opened_v1` (chart uuid)                       | Preference when opening a board        |
| Show on dashboard | `charts.show_on_dashboard` (**planned**; replaces `is_overview`)        | Which boards appear in Overview slider |
| Dashboard order   | `charts.dashboard_sort_order` (**planned**, positive ints, lower first) | Slide order                            |

Do not conflate last-opened with dashboard pin. **`is_overview` is deprecated** —
migrate pins to `show_on_dashboard`, then drop the unique-per-owner overview
column (it cannot represent multiple Overview slides).

## Client auth

Expired Supabase access tokens used to surface as generic **Request failed** /
`NEXT_REDIRECT` from client `apiFetch`. Client fetches now refresh once, then
emit a dashboard **Session expired** dialog (sign-in with `next` back to the
board) instead of calling Next `redirect()` from the browser.

## Current UI

| Control      | Behavior                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Search       | Debounced `?search=` via `router.push` (same as Views)                                          |
| Tabs         | **Active** / **Archived** only (no Shared tab — Views share is enough)                          |
| **+** menu   | **Add workspace** · **Add widget** (catalog)                                                    |
| Registry ⋯   | Archive / Restore / Delete; **Edit** (**planned**: name, description, order, show on dashboard) |
| Workspace ⋯  | **Save option** (**planned**; was Rename / Save) · Archive / Restore · Delete / Leave           |
| Board canvas | Grip drag, resize, filter / ⋯ on widgets. Dock disabled                                         |
| Fork         | **Planned:** icon left of **+** on shared boards → owned copy                                   |

**Share path:** header **Save view** → `/views` **Share**. Charts UI has no
native Share dialog and **no Shared registry tab**. Sharing a chart-backed view
grants **`chart_shares`**; recipients open from Views / inbox, then **Fork**
(**planned**) if they want an owned editable copy.

**Availability:** Only the **Chart** catalog template can be added. Other quick
picks / Browse cards are **Coming soon**.

### Chart widget (`typeId: chart`)

Live pie/donut/**bar**/column from rollup series API. Fullscreen config: Advanced/Quick filters
(Quick opens on **Project**; **Sprint** after a concrete project; **Assignee**
in the filter popover only; Advanced allows at most one row per column),
settings gear → Widget settings sidebar, layout Chart/Table/Split,
`pieVariant` (`pie` | `donut` | `bar` | `column`), and Labels `labelField`.

Status-grouped table uses board order (New → … → Done). Empty status groups are
hidden; search remounts matching groups expanded.

No Boards section (use project filters).

### Widget settings sidebar

| Section                      | Status today                                     | Notes                                                                     |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| Chart type                   | Pie / Donut / Bar / **Column** (unique only)     | Stacked/grouped / line / area / bubble removed from picker for now        |
| Labels                       | Live API-backed columns                          | Group / Name / Due date hidden until rollup supports them                 |
| Values                       | Count items only                                 | Sum / Average / … deferred                                                |
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
    (**planned** on `ChartBoardWidgetInstance`)
- `show_on_dashboard` + `dashboard_sort_order` (**planned**; migrate from
  `is_overview`, then drop `is_overview`)
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
- **Fork** (**planned**): `POST /api/charts/:id/fork` clones `board_json` +
  title/description under the viewer as owner (requires share access).

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

Use **Labels → Type** (or sprint report status breakdown) when you want to
separate Epics from Tasks. No parent–child ring is applied today.

**Future (after open questions):** optional **multilevel / nested donut** (inner
ring = roots or Epics, outer ring = direct children). Needs a dedicated
hierarchy rollup + counting rules. See
[CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md#hierarchy-and-future-chart-types)
and [open questions](./CHARTS_AGGREGATION.md#open-questions-before-nested--other-types).

**API:** `GET /api/v1/charts/analytics/series` and `…/analytics/drilldown` —
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

## Planned: Save option, descriptions, Alice suggest

Target UX (not fully shipped yet):

1. **Save option** dialogs (workspace create/save + widget ⋯): **Name** +
   **Description**. Menu label **Save option** (replaces Rename / Save).
2. Title row: info tooltip next to workspace / widget name. Empty description
   falls back to the default name (`Tasks by status`, `Sprint burndown`, or
   workspace title).
3. Top-right **Saving…** (spinner then text) for **every** board sync
   (`syncChartWorkspaceToApi`), including drag, filters, and Save option.
4. Alice **one-shot** suggest (no chat conversation): button beside description
   → `POST /api/v1/chat/generate-chart-description` with compact widget or
   workspace context → fills the draft for review before Save. Same pattern as
   project dynamic-fields `generate-fields-schema`.

## Planned: Dashboard Overview = chart workspace slider

Replace today’s mock `/dashboard` grid with a **horizontal slider** of chart
workspaces the viewer can access where `show_on_dashboard` is true, ordered by
`dashboard_sort_order`.

### Registry Edit (owned)

Row **Edit** opens: Name, Description (+ Alice), Order (positive), **Show on
dashboard**. No Shared registry tab — Views share remains the ACL path.

### Overview slide chrome (readonly-enhanced)

| Allowed                        | Hidden / disabled                                  |
| ------------------------------ | -------------------------------------------------- |
| Drag / resize (owned slides)   | Filters on Chart + Burndown widgets                |
| Fullscreen + Export            | Widget settings, Save option, duplicate, delete    |
| Drilldown + open `/work-items` | Shared slides: layout locked (sync already no-ops) |

Cache visited slides (keep-alive) so sliding back does not refetch. Empty pin
list → CTA to `/charts`. Full customization only on `/charts/[id]`.

### Workspace chrome

- Remove **All workspaces** button; breadcrumb **Charts** → `/charts`.
- **Fork** icon left of **+** on shared boards.

### Delivery order

1. Descriptions / Save option / Saving… / Alice
2. Schema flags + registry Edit + drop `is_overview`
3. Dashboard slider + readonly chrome
4. Fork + chrome cleanup
5. Tests + user-guide sync

## Preserved overview mock → future widgets

**Default Overview** becomes the workspace slider. Keep the legacy mock grid
behind an explicit query flag for design reference:

| URL                         | Renders                                      |
| --------------------------- | -------------------------------------------- |
| `/dashboard`                | Chart workspace slider (**planned** default) |
| `/dashboard?mockOverview=1` | Existing mock KPI / charts grid              |

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
- Nested donut / other Coming soon types in the same burndown delivery
- Keeping both `is_overview` and `show_on_dashboard` long-term

## Related

- Aggregation + burndown rollup plan: [CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md)
- Sprint burndown domain: [BURNDOWN_CHART.md](../sprints/BURNDOWN_CHART.md)
- User guide: `docs/user-guide/navigation/charts.md`,
  `docs/user-guide/navigation/dashboard-overview.md`
- Views sharing model: `docs/features/views/FAVORITES_AND_VIEWS.md`
