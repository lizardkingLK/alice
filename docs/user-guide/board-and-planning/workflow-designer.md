# Workflow designer

Design how work moves between states for a project — paths, who can move
items, and optional checks before a move.

**Audience:** Managers and admins

**Shipping note:** The Workflow tab supports the **canvas** (view states and
transitions, drag to rearrange) and **Settings** for the selected state or
transition (**Name**, **Category**, **Require children**, **Who can move**).
Lock / Terminal / escalation options and board runtime (workflow columns instead
of the legacy Board tab) land in later milestones.

---

## Open the designer

1. Open a **project** you manage.
2. Open the **Workflow** tab (project details).
3. Pick a workflow from the list (Default, or a team fork if present).

Members can use the board and change states according to the published
workflow; they cannot edit the graph.

---

## What you design

| Piece                   | Meaning                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **States**              | Columns on that workflow’s board (for example To Do, In Progress, Done)                                       |
| **Transitions (edges)** | Allowed moves from one state to another. Cycles are allowed (for example Dev ↔ QA) when both directions exist |
| **Type bindings**       | Which work-item types use this workflow                                                                       |
| **Settings**            | Options for the selected state or transition                                                                  |

Layout on the canvas is saved separately from the rules — moving boxes does not
change what transitions are allowed.

---

## State settings

Select a state, then open **Settings**:

| Setting                       | What it does                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Name** / description        | Labels on the board and in pickers                                                                         |
| **Category**                  | Groups states for filters and reports (`todo`, `in progress`, `done`, …)                                   |
| **Requires escalation**       | Leaving this state requires a filled **resolution** form on each outbound transition                       |
| **Lock record in this state** | While an item is here, most fields are read-only; changing state (for example reopen) can still be allowed |
| **Terminal state**            | No outbound transitions. If edges already leave this state, remove them before you can turn this on        |

Use the info icons for short explanations of each option.

---

## Transition settings

Select an edge between two states:

| Setting               | What it does                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Who can move**      | Limit the transition to roles, teams, or people                                                                                                                                                                        |
| **Resolution preset** | Optional named form to complete when taking this transition                                                                                                                                                            |
| **Require children**  | **Off** — no check. **All complete** — all direct subtasks must be in a done category. **Match parent target** — all direct subtasks must already be in the parent’s target state (or same category when types differ) |

Edges into a typical **Done** category are seeded with **All complete** so
parents cannot close while subtasks are still open.

---

## Resolution forms

Create a **named** form (simple fields such as text, select, checkbox). You can
edit it visually, preview it, or edit the JSON. Save it as a **preset** and
reuse it on other transitions in the same workflow.

---

## Default and forks

- Managers and admins mark one workflow as **default** and can delete others.
- A **team manager** (set on the project team) may **fork** the default once,
  edit the fork, and save a title/description. That fork cannot be forked
  again.
- Managers can review a fork, mark it default, and remove obsolete workflows.

If configuration is missing or invalid, the project safely uses a **seeded
default** workflow so the board keeps working.

---

## Board and Alice

- On the **Board**, use the workflow / type switcher to view one workflow’s
  columns at a time. See [Kanban board](./kanban-board.md).
- With the designer open, **Alice** can sit in a side panel and propose graph
  changes. Use **Apply** or **Reject** on the suggestion card. If you have
  unsaved canvas edits, Alice saves them first, then applies. See
  [Use the AI assistant](../chat/use-ai-assistant.md).

---

## Related

- [Board & planning](./README.md)
- [Kanban board](./kanban-board.md)
- [Assign and status](../work-items/assign-and-status.md)
- [Project settings](../projects/project-settings.md)
