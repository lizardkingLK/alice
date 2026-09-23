# Work items

Create, track, and discuss tasks, stories, bugs, and epics across projects.

**Audience:** All users

---

## In this topic

| Page                                                | What you'll learn                     |
| --------------------------------------------------- | ------------------------------------- |
| [Create a work item](./create-work-item.md)         | Add new items                         |
| [Edit a work item](./edit-work-item.md)             | Update title, description, and fields |
| [Assign and status](./assign-and-status.md)         | Ownership and workflow                |
| [Labels and priority](./labels-and-priority.md)     | Tags and urgency                      |
| [Comments and activity](./comments-and-activity.md) | Discussion and history                |
| [Attachments](./attachments.md)                     | Files on an item                      |

---

## Open the registry

1. In the sidebar under **Platform**, select **Work Items**.

You'll see the global work-item list at `/work-items`. **My Work** (`/member`)
shows the same table filtered to items assigned to you.

---

## List toolbar

Left side (filters and columns):

| Control               | Purpose                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search (**Ctrl/⌘+K**) | Filter by text                                                                                                                                                                                                                              |
| Filters (**Shift+F**) | Filter icon → project, sprint, type, assignee, and more                                                                                                                                                                                     |
| Columns               | Columns icon → show or hide table columns                                                                                                                                                                                                   |
| Defaults (sliders)    | Save or apply workspace project/sprint defaults                                                                                                                                                                                             |
| Applied filters       | Badges inline with toolbar controls (dismiss one or clear all). Overflowing chips scroll horizontally; scrollbar is hidden. Rapid chip dismissals are batched into one update after a short pause — use the filter dialog for bulk changes. |

In the table, **Project** cells are badges that open project details in a new
tab. **Sprint** cells are the same style of badge; for managers and admins they
link to the sprint summary report in a new tab. Members see the sprint name as
a plain badge (sprint reports require manager access).

Right side (views and actions):

| Control                   | Purpose                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Flat** / **Hierarchy**  | Flat list vs parent/child tree (icon segment switcher)                                                |
| **Active** / **Archived** | Same icon segment style as Flat/Hierarchy (managers/admins on `/work-items`; members use **My Work**) |
| **Add Work-Item**         | Open the create form                                                                                  |

In hierarchy mode, use **Expand all** / **Collapse all** on the table for the
current page.

Select a row to open the item detail page.

---

## Types and hierarchy

| Type      | Typical use                           |
| --------- | ------------------------------------- |
| **Epic**  | Large initiative                      |
| **Story** | User-facing slice under an epic       |
| **Task**  | Concrete work under a story           |
| **Issue** | Bug or small fix (leaf — no subtasks) |

Epics contain stories; stories contain tasks; tasks contain issues. Use
**Create subtask** or **Link Subtask** on the detail page to build the tree.

---

## Related

- [Kanban board](../board-and-planning/kanban-board.md)
- [Backlog](../board-and-planning/backlog.md)
