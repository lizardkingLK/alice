# Kanban board

See work by status and drag cards to update progress.

**Audience:** All users

---

## Open the board

1. In the sidebar under **Platform**, select **Board**.
2. Ensure the **Board** tab is selected (default at `/board`).

---

## Layout

Use the **Layout** icon (grid) in the board toolbar:

| Layout      | What you see                                               |
| ----------- | ---------------------------------------------------------- |
| **Board**   | Classic Kanban columns (default)                           |
| **Grouped** | One collapsible table per board column (Charts-style list) |

Your choice is remembered in the browser for your account. In **Grouped**
layout, drag a row onto another column group to update status — same rules as
dragging cards on the board.

---

## Columns

Cards group by status:

**New** → **To Do** → **In Progress** → **Testing** → **Done**

**Draft** items do not appear on the board.

---

## Update status

Drag a card from one column to another. Status saves automatically.

You can also change status from the work-item detail sidebar or the Work Items
registry.

---

## Filters

Use search, the **Filter** icon (**Shift+F**), then the people avatars — in that
order — for project, sprint, priority, labels, and assignee.

In the Filter dialog, on the **Project** or **Sprint** pane you can check
**Set as default**. Okay applies the filters to the URL and, if that box is
checked, saves workspace defaults (All projects / All sprints clears saved
defaults). Changing filters without checking the box does not change defaults.

When any concrete filter is active in the URL, filter badges sit on the same
toolbar row as search and filters (they take remaining space). **All projects**
and **All sprints** are not shown as badges. When chips overflow, scroll the
strip horizontally with the trackpad, mouse wheel, or Shift+wheel (scrollbar is
hidden so short chips stay visually centered). Each badge names an applied
filter (with an icon); use the badge **X** to remove just that filter, or the
clear icon after the badges to reset filters. Rapid chip dismissals update the
strip immediately and apply as one filter refresh after a short pause (so a
fast burst is one request). Use the filter dialog if you need to change several
filters at once in a structured way.

Sidebar links for Board, Backlog, and Work items include your saved project /
sprint defaults when set; with no saved defaults they open the unscoped view.

Save a filtered URL as a [view](../navigation/favorites-and-views.md).

---

## Related

- [Calendar view](./calendar-view.md)
- [Assign and status](../work-items/assign-and-status.md)
