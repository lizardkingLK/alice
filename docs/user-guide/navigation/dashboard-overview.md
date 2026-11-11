# Dashboard overview

Your home screen under **Overview** — switch between a **productivity
dashboard** and a **slider of chart workspaces** you pin from Charts.

**Audience:** All users

---

## Open Overview

1. Sign in to Alice.
2. In the sidebar under **Platform**, select **Overview**.

You'll land on `/dashboard`.

---

## Customize Overview

Use the **Customize** control (sliders icon) to open a dialog where you can:

- Switch **Overview mode** between **Productivity** and **Chart workspaces**
- Under Chart workspaces, open a link to **customize the active board** on
  Charts
- Turn productivity widgets on or off

Your mode and widget choices are saved in this browser (local storage + cookie).

Overview defaults to **Productivity**. You can switch to **Chart workspaces**
anytime; if nothing is pinned yet, that mode shows a short tip and **Open Charts**.

---

## Productivity dashboard

A draggable, resizable home with frosted glass cards on a soft gradient. By
default you get two widgets side by side:

| Widget | What it shows                                                                                                                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alice  | Live chat that always starts a new thread (open full chat from the card)                                                                                                                      |
| Focus  | Timer (5 minutes–8 hours, default 25) plus a personal todo list. Duration, run/pause, remaining time, and todos stay in this browser; a running timer continues after you leave and come back |

Turn on more widgets from **Customize**:

| Widget               | What it shows                                                               |
| -------------------- | --------------------------------------------------------------------------- |
| Assigned to you      | Open work items assigned to you                                             |
| Pending stories      | Open stories assigned to you                                                |
| In progress          | Items in In Progress                                                        |
| Work in progress     | Top five open assigned items, with a **% completed** pill for assigned Done |
| Unread notifications | Latest unread alerts                                                        |
| Your projects        | Projects you belong to                                                      |
| Docs                 | Search the user guide; open a page in a dialog                              |

**Work in progress** and **Unread notifications** start off; turn them on in
**Customize** when you want the same lists on Overview that Home shows.

**Chart workspaces** mode is always available. If nothing is pinned yet, that
mode shows a short tip and **Open Charts** instead of the slider.

Hold the ellipsis on a card to drag; resize from the bottom-right. Layout is
saved automatically.

---

## Chart workspace slider

Overview can also show chart workspaces marked **Show on dashboard** (with a
sort order) in the Charts registry. When more than one board is pinned, use the
slide tabs or arrows to switch. A single pinned board shows without the slider.

On each slide you can:

- Drag and resize widgets on **your** boards (shared slides stay layout-locked)
- Drill into chart slices and open work items
- Use **Fullscreen** and **Export**

Filters, widget settings, Save option, duplicate, and delete stay on the Charts
board — Overview keeps a read-focused chrome. Open **Customize** → Chart
workspaces → **Customize active board** to edit the full board on
`/charts/[id]`.

### Pin and order boards

1. Open **Charts**.
2. On an **Active** row, open **⋯ → Edit**.
3. Turn on **Show on dashboard**.
4. Set **Dashboard order** (lower numbers appear earlier).

You can pin multiple workspaces. Sharing stays on **Views**; recipients can
**Fork** a shared board into their own copy from the board header.

### Design reference (mock grid)

The older mock overview (KPI cards, velocity, activity list) remains available
only at `/dashboard?mockOverview=1` for design reference. That URL will go away
once Numbers / velocity / activity chart widgets replace those mocks.

---

## From Overview

Use the sidebar to jump to **Charts**, **Board**, **Work Items**, **My Work**,
**Backlog**, or **Projects**. Use the header **bell** for notifications and
**Alice** for the AI assistant.

---

## Related

- [Charts](./charts.md)
- [Keyboard shortcuts](./keyboard-shortcuts.md)
- [Favorites and views](./favorites-and-views.md)
