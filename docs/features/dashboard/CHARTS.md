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
config: Advanced/Quick filters, assignee avatars, settings gear → Widget
settings sidebar, layout Chart/Table/Split, pie vs donut (`pieVariant`), and
Labels column (`labelField`: Project / Group / Name / Owner / Status / Due date).

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
Board **Grouped** layout (board groups by workflow column; Charts by status).

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

Chart widgets still use in-memory sample rows. Production path: precomputed /
materialized snapshot, cheap client filters — not heavy joins per slice.

## Non-goals (near term)

- Public/anonymous chart links
- Putting layout into `saved_views.search`
- Nested widget route as the only configuration UI
- Sharing Favorites

## Related

- User guide: `docs/user-guide/navigation/charts.md`
- Views sharing model: `docs/features/views/FAVORITES_AND_VIEWS.md`
