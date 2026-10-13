# Assign and status

Set who owns work and move items through your workflow.

**Audience:** All users

---

## States and categories

Each work item follows its project **workflow** (by type). The details sidebar
shows the **workflow name** and the current **state**. Lists and filters group
work by **category** (for example to do, in progress, done) so cross-project
views stay simple.

Typical default states (projects may rename or add their own):

| State           | Usual category | Meaning               |
| --------------- | -------------- | --------------------- |
| **Draft**       | draft          | Not on the board yet  |
| **New**         | todo           | Ready but not started |
| **To Do**       | todo           | Queued for work       |
| **In Progress** | in progress    | Actively being worked |
| **Testing**     | in progress    | In review or QA       |
| **Done**        | done           | Complete              |

On the work-item details page, the header banner shows the current **state**
(icon + color) with the title, type, key, project, and assignee. Change state
from the colorized **State** control in the sidebar (or **Status** on projects
that still use a legacy board). The work-items list and Charts drilldown table
also show a **State** column (next to **Status**) with the same workflow label.
The board (drag cards) and bulk actions also move items where available.

Only **allowed transitions** succeed — including moves back (for example
Testing → In Progress) when the workflow defines them. If the transition
**Requires escalation**, you complete the **resolution form** (fields +
**Outcome**) before the move finishes.

**Draft**-category states stay off the kanban board. You can still move an item
into a draft state from details; it leaves the board until it returns to a
non-draft state.

---

## Assignee, reporter, sprint, and due date

- **Assignee** — who is responsible for delivery
- **Reporter** — who reported or owns the request
- **Sprint** — which sprint the item belongs to, or **Backlog** when cleared
- **Due date** — optional calendar day the item should be finished by

Use the searchable controls (and date picker for due date) in the create/edit
dialogs and the details sidebar. **My Work** filters the registry to items where
you are assignee. The calendar view also shows items by due date.

---

## Completion and locks

Workflow edges can set **Require children** to **Off**, **All complete** (direct
subtasks must be in a done category), or **Match parent target** (direct
subtasks must already be in the parent’s target state, or the same category when
types differ). If blocked, a dialog explains what to fix.

When a state has **Lock record in this state**, most fields stay read-only until
you move the item (for example reopen from Done). **Terminal state** means no
outbound moves.

Managers configure these rules in the
[Workflow designer](../board-and-planning/workflow-designer.md).

---

## Board and backlog

- **Board** — pick a workflow in the switcher, then drag cards between columns
- **Backlog** — drag items into sprints or reorder within the backlog pane

---

## Related

- [Kanban board](../board-and-planning/kanban-board.md)
- [Workflow designer](../board-and-planning/workflow-designer.md)
- [Edit a work item](./edit-work-item.md)
- [Comments and activity](./comments-and-activity.md)
