# Charts (custom dashboards)

Per-user **chart workspaces** (boards of widgets). Routing is id-based; the
sidebar opens the last-used workspace. Layout persists in localStorage today
and will move to the `charts` table + Views-style sharing.

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

Do not conflate these flags.

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

Sample pie from `charts-sample.data.ts`. Canvas shows pie/donut. Fullscreen
config: Advanced/Quick filters (Quick opens on **Project**; **Sprint** is
available after a concrete project is selected — same rule in Advanced;
**Assignee** lives in the filter popover only; Advanced allows at most one row
per column — no duplicate Status/Type/… under AND; no Save filters or filter
groups), settings gear → Widget settings sidebar, layout Chart/Table/Split,
pie vs donut (`pieVariant`), and Labels column (`labelField`: Project / Group /
Name / Owner / Status / Due date).

### Widget settings sidebar

| Section                      | Behavior                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| Chart type                   | Interactive Pie / Donut; other types Coming soon                         |
| Labels                       | Columns picker (Project / Group / Name / Owner / Status / Due date) live |
| Values / Customize           | Static stubs                                                             |
| Groups                       | Static checklist of all work-item statuses                               |
| Choose which columns to show | Static table column checklist                                            |

Labels group the mock pie by the selected field (`labelField` on the widget
instance; default Status). Clicking a slice (any Labels field) opens Split and
scopes the status-grouped table to that bucket (`focusedSliceKey`). Changing
Labels clears the slice focus. The legend uses a fixed-height scroll area.

Status-grouped table UI shares `GroupedItemsSection` /
`GroupedItemsPaginatedTable` (`apps/web/components/grouped-items/`) with the
Board **Grouped** layout (board groups by workflow column; Charts by status in
board order). Empty status groups are hidden; search/filter results remount
matching groups expanded.

No Boards section (use project filters).

## Persistence

### Client (interim)

Multi-workspace JSON in localStorage (migrates legacy single-board keys):

- Workspaces: `{ id, title, description?, status, isOverview, updatedAt, instances, layout }`
- `lastOpenedId`
- Legacy `alice.charts.board.layout.v1` / `instances.v1` imported once into a default workspace

### Server (API + schema)

Table **`charts`**:

- `id`, `owner_id`, `title`, `description?`
- `board_json` (widgets + layout)
- `is_overview` (at most one active overview per owner)
- `status`, audit columns

Sharing:

- **`chart_shares`** mirrors `saved_view_shares` (recipient ACL on the chart row).
- Optional **saved view** bookmark of `/charts/[id]` so the board appears in `/views` and reuses share UX / notifications pattern.
- Do **not** store board JSON inside `saved_views`.

Notification type: `chart_shared` (inbox deep-link to `/charts/[id]`).

## Data strategy (widget payloads)

**Tier 1 (shipped):** categorical pie series from table
`work_item_chart_rollups` (trigger-maintained counts on Supabase). Slice →
table uses **paginated** live `work_items` via drilldown. Measure: **`item_count`
only**.

**API:** `GET /api/v1/charts/analytics/series` and `…/analytics/drilldown` —
see [CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md#apis).

**Web:** Chart widgets load series/drilldown from that API. **Project** filter
supports **All projects** (aggregates every project the user can access) or a
single project. Optional **sprint** is seeded from workspace defaults.
Labels → Columns supports Project, Owner, Status, Type, and Priority
(Group / Name / Due date are not on the rollup yet).

**Defaults:** Charts uses the same workspace defaults dialog as Board / Work
items / Backlog. Saving defaults seeds **project** (and **sprint** when set)
onto newly inserted Chart widgets.

Tier 2/3 (Neon read model, apps rename) and the completed step checklist:
[CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md).

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
