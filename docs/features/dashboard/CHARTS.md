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

| Path                             | Behavior                                                           |
| -------------------------------- | ------------------------------------------------------------------ |
| `/charts`                        | Workspace registry (Active / Archived + search + create)           |
| `/charts/[id]`                   | Workspace canvas (widgets + layout); **All workspaces** → registry |
| `/charts/[id]/widget/[widgetId]` | Same workspace; auto-opens that widget’s config dialog             |

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

## Last-opened vs overview

| Concern       | Storage                                           | Used by                         |
| ------------- | ------------------------------------------------- | ------------------------------- |
| Last opened   | Cookie `alice_charts_last_opened_v1` (chart uuid) | Preference when opening a board |
| Overview mark | `isOverview` on one workspace per user            | Overview page (later bind)      |

Do not conflate these flags.

## Client auth

Expired Supabase access tokens used to surface as generic **Request failed** /
`NEXT_REDIRECT` from client `apiFetch`. Client fetches now refresh once, then
emit a dashboard **Session expired** dialog (sign-in with `next` back to the
board) instead of calling Next `redirect()` from the browser.

## Current UI

| Control      | Behavior                                                                         |
| ------------ | -------------------------------------------------------------------------------- |
| Search       | Debounced `?search=` via `router.push` (same as Views)                           |
| Tabs         | **Active** / **Archived** (no Shared tab)                                        |
| **+** menu   | **Add workspace** (opens name dialog, then creates) · **Add widget** (catalog)   |
| Workspace ⋯  | **Rename / Save** · Archive / Restore · Delete (Leave when opened via chart ACL) |
| Board canvas | Grip drag, resize, filter / ⋯ on widgets. Dock disabled                          |

**Share path:** header **Save view** → `/views` **Share**. Charts UI has no
native Share dialog. Sharing a chart-backed view grants **`chart_shares`**.

**Availability:** Only the **Chart** catalog template can be added. Other quick
picks / Browse cards are **Coming soon**.

### Chart widget (`typeId: chart`)

Live pie/donut/**bar** from rollup series API. Fullscreen config: Advanced/Quick filters
(Quick opens on **Project**; **Sprint** after a concrete project; **Assignee**
in the filter popover only; Advanced allows at most one row per column),
settings gear → Widget settings sidebar, layout Chart/Table/Split,
`pieVariant` (`pie` | `donut` | `bar`), and Labels `labelField`.

Status-grouped table uses board order (New → … → Done). Empty status groups are
hidden; search remounts matching groups expanded.

No Boards section (use project filters).

### Widget settings sidebar

| Section                      | Status today                                     | Notes                                                               |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| Chart type                   | Pie / Donut / **Bar** live; others Coming soon   | Stacked/grouped bar deferred                                        |
| Labels                       | Live API-backed columns                          | Group / Name / Due date hidden until rollup supports them           |
| Values                       | Count items only                                 | Sum / Average / … deferred                                          |
| Customize                    | % vs count, sort, empty slices, **slice colors** | Theme swatches (`chart-1`…`8`); reset on Labels change              |
| Groups                       | Coming soon (deferred)                           | Table already hides empty status groups                             |
| Choose which columns to show | Drilldown column visibility                      | Default: Task/Owner/Status/Type/Priority; Project + Sprint optional |

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
- `is_overview` (at most one active overview per owner)
- `status`, audit columns

Sharing:

- **`chart_shares`** — recipient ACL on the chart row (board access).
- **Views** — users opt in with header **Save view**. Saving `/charts/[id]`
  stamps `resource_kind=chart` + `resource_id`. Sharing that view from
  `/views` upserts `saved_view_shares` **and** `chart_shares`. Leaving the
  view share also deletes the matching chart share.
- Chart CRUD does **not** auto-upsert Views bookmarks.
- Do **not** store board JSON inside `saved_views.search`.

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

**API:** `GET /api/v1/charts/analytics/series` and `…/analytics/drilldown` —
see [CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md#apis).

**Web:** Chart widgets load series/drilldown from that API. **Project** filter
supports **All projects** or a single project. Optional **sprint** from
workspace defaults. Labels → Columns: Project, Owner, Status, Type, Priority
(Group / Name / Due date not on the rollup yet).

**Defaults:** Same workspace defaults dialog as Board / Work items / Backlog.
Saving defaults seeds **project** (and **sprint** when set) onto newly inserted
Chart widgets.

**Drilldown table:** Widget settings → **Choose which columns to show** includes
an **Actions** column (on by default). Row **⋯** offers **Open** (`/work-items/[id]`)
and **Edit** (preferred `WorkItemFormDialog`). After a successful edit, the client
clears the in-memory series/drilldown caches (`invalidateChartAnalyticsCaches`)
and calls `router.refresh()` so pie + table refetch without a full page reload.

**Tier 1 product (incomplete):** workspace cloud + Views index + settings —
[checklist](./CHARTS_AGGREGATION.md#tier-1-product-remaining).

Tier 2/3 (Neon read model, apps rename): [CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md).

## Non-goals (near term)

- Public/anonymous chart links
- Putting layout into `saved_views.search`
- Nested widget route as the only configuration UI
- Sharing Favorites
- Native Charts Share dialog / Shared-with-me registry tab
- Neon / Render / Upstash wiring (Tier 2+)

## Related

- Aggregation design: [CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md)
- User guide: `docs/user-guide/navigation/charts.md`
- Views sharing model: `docs/features/views/FAVORITES_AND_VIEWS.md`
