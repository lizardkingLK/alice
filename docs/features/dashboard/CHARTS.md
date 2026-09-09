# Charts (custom dashboards)

UI-first route for per-user, shareable chart boards. Persistence (JSON layout
per user, slug routes, Views-style sharing) lands in a follow-up. Local layout
is stored in the browser for the current board canvas.

## Route

- Path: `/charts`
- Sidebar: **Charts** under platform nav (`nav-registry.ts`)
- Shell: `DashboardShell` with `contentScrollable={false}` so the board card
  fills remaining viewport height (same pattern as Board / Chat)

## Current UI

| Control      | Behavior                                                             |
| ------------ | -------------------------------------------------------------------- |
| Search       | Debounced query (`?search=`) — reserved for multi-board list later   |
| Filter       | Dialog (Shift+F): ownership + status → `?ownership=` / `?status=`    |
| Add Widget   | Monday-style dropdown: quick picks (icon + title + description)      |
| More widgets | Opens **Browse Widgets** (categories, search, hero, card grid)       |
| Board canvas | Monday-style cards: grip drag, filter, ⋯ menu (fullscreen / rename / |
|              | duplicate / delete). Settings + dock disabled for now                |

**Availability:** Only the **Chart** catalog template can be added today. Other
quick picks and Browse cards are disabled with a **Coming soon** label until
those widget bodies ship.

**Chart widget (`typeId: chart`):** sample pie from `charts-sample.data.ts`
(~100 dummy work items for pagination demos). The **board canvas always shows
the pie** regardless of layout mode. Widget **Filter** / **Full screen** opens
a fullscreen config dialog with **Advanced filters** (Project / Where rows,
remove-row X, dynamic value options) or **Quick filters** (work-items-style
field checklist). Toolbar includes assignee `AvatarGroup` (board-style). Config
⋯ menu: Exit full screen, Settings (disabled), Rename, Duplicate, Export
submenu, Delete. Canvas chart ⋯ also includes Export.

### Layout modes (fullscreen only)

Per-instance `viewMode` (`chart` | `table` | `split`) is stored on the widget
in local board JSON. It only affects the fullscreen config preview — not the
canvas card. Default is **Chart**. The toolbar control always uses the
**Columns2** (split) icon; the menu lists Chart / Table / Split mode.

| Mode       | Fullscreen body                                          |
| ---------- | -------------------------------------------------------- |
| Chart      | Full pie + legend                                        |
| Table      | Status-grouped collapsible tables with client pagination |
| Split mode | Pie on top, table below (chart slightly larger)          |

In **Table** / **Split** table panes: **+** on a status group header opens
create (status locked to that group); row **⋯ → Edit** opens the shared
`WorkItemFormDialog`. Mutations use form `localMutate` against session mock
rows and reset on full page reload (not persisted).

In fullscreen, clicking a pie slice (or legend row) switches to **Split** and
focuses the table on that status group (`focusedStatus`). Choosing Chart /
Table / Split from the layout menu clears the status focus.

### Data strategy (planned)

Today the Chart widget uses **in-memory sample rows** only (no API). The
intended production path is:

1. **Preload** chart-ready aggregates / row sets once from a **materialized
   view** (or equivalent denormalized snapshot), not ad-hoc heavy joins on
   every widget render.
2. Serve that payload to the board / fullscreen client so filters, layout
   modes, and table pagination stay cheap (client-side over the prefetched
   set, or thin reads against the snapshot).
3. Refresh the snapshot on a controlled cadence / invalidation path — not a
   live deep query per pie slice or page change.

This keeps chart boards snappy and avoids repeated expensive DB hits while
users flip Chart / Table / Split and paginate status groups.

The charts card uses remaining shell height (padding kept). Empty state fills
that area; adding widgets grows the grid and the content scrolls inside the
card when it exceeds the viewport.

### Add Widget menu (quick)

Quick options match Monday’s add menu: Chart, Data over time, Numbers, Battery,
Gantt, Files Gallery, then Apps, then **More widgets**. Non-Chart options stay
visible but disabled (**Coming soon**).

### Browse Widgets

Full dialog with category sidebar (Staying on Top, Delivery, Media, Personal,
Apps), header search, promotional banner, and “Add widget” cards. Non-Chart
cards show **Coming soon** and cannot be added yet. The same available template
can still be placed multiple times.

## Layout model (planned persistence)

- Widget instances: `{ instanceId, typeId, title?, filters?, viewMode?, focusedStatus? }`
  (many instances may share a `typeId`; `title` is the per-instance rename)
- RGL layout items keyed by `instanceId` (w/h/x/y, min sizes)
- Next: replace localStorage with per-user board JSON + `/charts/[slug]`
  and per-instance config

## Next

1. Persist board JSON (widgets + layout) per user on the API
2. Slug detail route `/charts/[slug]`
3. Share via saved-views-style ACL
4. Bind real chart data into widget bodies (Chart type has a sample pie +
   client-side Advanced/Quick filters + layout modes persisted on the local
   board JSON; other types are still placeholders / Coming soon)
5. Browse Widgets / grid from `/dashboard` customizer
6. Persist per-widget Advanced filters on the API
7. Enable additional catalog templates as their UIs land
