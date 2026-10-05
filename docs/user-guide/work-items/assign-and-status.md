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

Change state from the work-item sidebar, the board (drag cards), or bulk actions
where available. Only **allowed transitions** appear or succeed — including
moves back (for example Testing → In Progress) when the workflow defines them.

**Draft** items are hidden from the kanban board unless the project workflow
exposes a matching state.

---

## Assignee and reporter

- **Assignee** — who is responsible for delivery
- **Reporter** — who reported or owns the request

Use the searchable dropdowns in the sidebar. **My Work** filters the registry to
items where you are assignee.

---

## Completion and locks

Workflow edges can require that **direct subtasks** are finished (**All
complete**) or already in the parent’s target state (**Match parent target**)
before you move the parent. If blocked, a dialog explains what to fix.

When a state has **Lock record in this state**, most fields stay read-only until
you move the item (for example reopen from Done). **Terminal** states have no
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
