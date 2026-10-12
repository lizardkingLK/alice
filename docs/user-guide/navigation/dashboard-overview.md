# Dashboard overview

Your home screen under **Overview**. Alice is moving this page from a fixed
mock widget grid to a **slider of chart workspaces** you pin from Charts.

**Audience:** All users

---

## Open Overview

1. Sign in to Alice.
2. In the sidebar under **Platform**, select **Overview**.

You'll land on `/dashboard`.

---

## What you see today

Overview currently shows a **widget grid** you can rearrange:

- Drag widgets to reorder
- Resize from widget corners where supported
- **Reset layout** restores the default arrangement

Widget examples include open issues, work by status, sprint burndown, team
velocity, and recent activity. Exact widgets depend on your workspace data.

**Sprint burndown** uses your board defaults (project / sprint) when set.
The widget header shows the **Project** and **Sprint** names on the top right
so you can see the scope at a glance.

Your layout is saved in the browser for your account on this device.

---

## Coming soon: chart workspace slider

Overview will show a **slider** of chart workspaces you marked **Show on
dashboard** (with a sort order) in the Charts registry. Each slide is a
read-focused board:

- Drill into slices and open work items
- Fullscreen and export stay available
- Filters and widget settings stay on `/charts/[id]` for editing

Pin and order boards from **Charts** → row **Edit**. Share boards via
**Views** (same as today); recipients can **Fork** a shared board into their
own copy when that control ships.

### Design reference (mock grid)

While the slider rolls out, the old mock overview remains available only when
you open `/dashboard?mockOverview=1`. That URL is for design reference and will
be removed once Numbers / velocity / activity chart widgets replace those
mocks.

---

## From Overview

Use the sidebar to jump to **Charts**, **Board**, **Work Items**, **Backlog**,
or **Projects**. Use the header **bell** for notifications and **Alice** for
the AI assistant.

---

## Related

- [Charts](./charts.md)
- [Keyboard shortcuts](./keyboard-shortcuts.md)
- [Favorites and views](./favorites-and-views.md)
