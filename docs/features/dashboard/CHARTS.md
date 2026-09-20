# Charts (custom dashboards)

Per-user **chart workspaces** (boards of widgets). Routing is id-based; the
sidebar opens the last-used workspace. Layout persists in **`charts.board_json`**
(source of truth) with a localStorage cache after hydrate. **Tier 1 product**
workspace cloud + Views indexing + Widget settings are wired — see
[Persistence](#persistence) and
[CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md#tier-1-product-remaining).

## Routes

| Path                             | Behavior                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `/charts`                        | Redirect to last-opened workspace id (localStorage), or create a default workspace |
| `/charts/[id]`                   | Workspace canvas (widgets + layout)                                                |
| `/charts/[id]/widget/[widgetId]` | Same workspace; auto-opens that widget’s config dialog                             |

- Sidebar **Charts** stays `path: '/charts'` in `nav-registry.ts` (redirect resolves the id).
- Use UUID ids (same as sprints/projects).
- Nested widget route keeps Monday-style modal/sidebar config — it does not invent a second product shell.

Shell: `DashboardShell` with `contentScrollable={false}`.

## Last-opened vs overview

| Concern       | Storage                                                | Used by                      |
| ------------- | ------------------------------------------------------ | ---------------------------- |
| Last opened   | `alice.charts.workspaces.v1:{userId}` → `lastOpenedId` | Sidebar / `/charts` redirect |
| Overview mark | `isOverview` on one workspace per user                 | Overview page (later bind)   |

Do not conflate these flags. After cloud wiring, last-opened should sync from
the server (or a synced preference), not only localStorage.

## Current UI

| Control      | Behavior                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------- |
| Search       | Debounced `?search=` on the workspace list / title filter                                |
| Filter       | Workspace picker: ownership + status filters, list/load workspaces, save / mark overview |
| **+** menu   | **Add workspace** (opens name dialog, then creates) · **Add widget** (catalog)           |
| Workspace ⋯  | **Share** (project members + `chart_shares`) · **Rename / Save**                         |
| Board canvas | Grip drag, resize, filter / ⋯ on widgets. Dock disabled                                  |

**Availability:** Only the **Chart** catalog template can be added. Other quick
picks / Browse cards are **Coming soon**.

### Chart widget (`typeId: chart`)

Live pie/donut from rollup series API. Fullscreen config: Advanced/Quick filters
(Quick opens on **Project**; **Sprint** after a concrete project; **Assignee**
in the filter popover only; Advanced allows at most one row per column),
settings gear → Widget settings sidebar, layout Chart/Table/Split,
`pieVariant`, and Labels `labelField`.

Status-grouped table uses board order (New → … → Done). Empty status groups are
hidden; search remounts matching groups expanded.

No Boards section (use project filters).

### Widget settings sidebar

| Section                      | Status today                         | Notes                                                     |
| ---------------------------- | ------------------------------------ | --------------------------------------------------------- |
| Chart type                   | Pie / Donut live; others Coming soon | Keep                                                      |
| Labels                       | Live API-backed columns              | Group / Name / Due date hidden until rollup supports them |
| Values                       | Count items only                     | Sum / Average / … deferred                                |
| Customize                    | % vs count, sort, show empty slices  | Persisted on widget instance                              |
| Groups                       | Coming soon (deferred)               | Table already hides empty status groups                   |
| Choose which columns to show | Drilldown column visibility          | Persisted on widget                                       |

Clicking a Labels slice opens Split and scopes the table (`focusedSliceKey`).
Changing Labels clears the slice focus.

## Persistence

### Client (cache)

Multi-workspace JSON in localStorage (migrates legacy single-board keys):

- Workspaces: `{ id, title, description?, status, isOverview, ownership?, updatedAt, instances, layout }`
- `lastOpenedId`
- Legacy `alice.charts.board.layout.v1` / `instances.v1` imported once into a default workspace

On load, `hydrateChartWorkspacesFromApi` lists owned + shared charts, migrates
any local-only boards via POST, then rewrites the local cache from the API.

### Server (source of truth)

Table **`charts`**:

- `id`, `owner_id`, `title`, `description?`
- `board_json` (widgets + layout) — **source of truth for board data**
- `is_overview` (at most one active overview per owner)
- `status`, audit columns

Sharing:

- **`chart_shares`** — recipient ACL on the chart row (board access).
- **Views bookmark** — upsert `saved_views` with typed `resource_kind=chart` +
  `resource_id=charts.id` so `/views` can index charts without pathname scans.
  See [FAVORITES_AND_VIEWS.md](../views/FAVORITES_AND_VIEWS.md#chart-workspaces).
- Do **not** store board JSON inside `saved_views.search`.

Notification type: `chart_shared` (inbox deep-link to `/charts/[id]`).

Create / update / archive / restore upsert the Views bookmark automatically.

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

**Tier 1 product (incomplete):** workspace cloud + Views index + settings —
[checklist](./CHARTS_AGGREGATION.md#tier-1-product-remaining).

Tier 2/3 (Neon read model, apps rename): [CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md).

## Non-goals (near term)

- Public/anonymous chart links
- Putting layout into `saved_views.search`
- Nested widget route as the only configuration UI
- Sharing Favorites
- Neon / Render / Upstash wiring (Tier 2+)

## Related

- Aggregation design: [CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md)
- User guide: `docs/user-guide/navigation/charts.md`
- Views sharing model: `docs/features/views/FAVORITES_AND_VIEWS.md`
