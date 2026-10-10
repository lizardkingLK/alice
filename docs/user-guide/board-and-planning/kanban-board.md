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

## Columns and workflow switcher

When a **project** is selected, columns come from that project’s **workflow**
(states such as To Do, In Progress, Testing, Done). Use the **workflow / type
switcher** on the board to view one workflow at a time (for example Default vs
Bug). Each work-item type follows the workflow it is bound to; cards only appear
on the matching board.

Without a custom workflow (or if configuration is invalid), the board uses a
safe **default** set of columns:

**New** → **To Do** → **In Progress** → **Testing** → **Done**

**Draft** items do not appear on the board unless a designer adds an equivalent
state.

Managers configure paths, who may move cards, and subtask checks in the project
[Workflow designer](./workflow-designer.md).

---

## Update status

Drag a card from one column to another when that move is allowed. The change
saves automatically. A move with no matching transition in the workflow is
blocked as **not allowed**. If the transition exists but **Who can move**
restricts you, you see a **permission** message instead. Some moves may also ask
for a short form or block until subtasks are ready.

You can also change state from the work-item detail sidebar or the Work Items
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

- [Workflow designer](./workflow-designer.md) (managers)
- [Calendar view](./calendar-view.md)
- [Assign and status](../work-items/assign-and-status.md)
