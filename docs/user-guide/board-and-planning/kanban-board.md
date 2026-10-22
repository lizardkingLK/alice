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

## Columns and workflows

When a **project** is selected, columns come from that project’s active
**workflow** (states such as To Do, In Progress, Testing, Done). The board
shows one workflow at a time — the project default, or another workflow when
the URL includes `?workflow=<id>`. Each work-item type follows the workflow it
is bound to; cards only appear on the matching board.

If workflow configuration is missing or invalid, the board uses a safe
**default** set of columns:

**New** → **To Do** → **In Progress** → **Testing** → **Done**

**Draft** items do not appear on the board unless the workflow includes an
equivalent state.

Managers configure paths, who may move cards, locks, resolution forms, and
subtask checks in the project [Workflow designer](./workflow-designer.md)
(**Workflow** tab — not a separate Board designer).

---

## Update status

Drag a card from one column to another when that move is allowed. The change
saves automatically. Blocked moves show a toast titled **Move blocked** with the
reason underneath — for example a missing transition, a **Who can move**
permission rule, or a subtask / children check. Some moves may also ask for a
short form before the status changes.

You can also change state from the work-item detail sidebar or the Work Items
registry.

### Board sync

Open **Board settings** (grid icon on the board toolbar). Under **Board sync**:

| Option                 | What it does                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Realtime** (default) | Cards update live when teammates move items. Your drag does not wait on the save request; the card stays fully opaque while saving. |
| **Static**             | No live merge from others until you refresh or navigate. Pending saves dim the card (classic behavior).                             |
| **Subscribe to moves** | Only in Realtime. Turn off to stop applying placement changes over the wire while keeping Realtime mode selected.                   |

While any move save is in flight, a small **Saving…** indicator appears on the
toolbar (top right). You can re-drag the same card while a save is still running
— Alice keeps your latest column and finishes the network work in order. If you
close or refresh the tab with unsaved moves, the browser may warn you and Alice
tries a last keepalive save.

Preferences are stored in this browser for your account. If someone else moves
the same card first, you get a short toast (**Someone else moved this item**)
and the board shows their column — not a merge dialog. Live sync applies on
**Board** (`/board`), not on the home dashboard. Engineers:
[Realtime board moves](../../features/board/REALTIME_BOARD_MOVES.md).

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
