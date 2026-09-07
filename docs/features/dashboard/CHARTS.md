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

The charts card uses remaining shell height (padding kept). Empty state fills
that area; adding widgets grows the grid and the content scrolls inside the
card when it exceeds the viewport.

### Add Widget menu (quick)

Quick options match Monday’s add menu: Chart, Data over time, Numbers, Battery,
Gantt, Files Gallery, then Apps, then **More widgets**.

### Browse Widgets

Full dialog with category sidebar (Staying on Top, Delivery, Media, Personal,
Apps), header search, promotional banner, and “Add widget” cards. The same
template (e.g. Numbers) can be added multiple times; each placement is its own
instance to configure later (filters, work-item type, etc.).

## Layout model (planned persistence)

- Widget instances: `{ instanceId, typeId, title? }` (many instances may share
  a `typeId`; `title` is the per-instance rename)
- RGL layout items keyed by `instanceId` (w/h/x/y, min sizes)
- Next: replace localStorage with per-user board JSON + `/charts/[slug]`
  and per-instance config

## Next

1. Persist board JSON (widgets + layout) per user on the API
2. Slug detail route `/charts/[slug]`
3. Share via saved-views-style ACL
4. Bind real chart data into widget bodies (placeholders today)
5. Browse Widgets / grid from `/dashboard` customizer
