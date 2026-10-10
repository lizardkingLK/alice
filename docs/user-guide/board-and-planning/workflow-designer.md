# Workflow designer

Design how work moves between states for a project — paths, who can move
items, and optional checks before a move. This is the **only** place to edit
workflow configuration (the old Board column designer is retired).

**Audience:** Managers and admins

---

## Open the designer

1. Open a **project** you manage.
2. Open the **Workflow** tab (project details).
3. Pick a workflow from the list (Default, or a team fork if present).

Use **Save** to persist canvas layout and Settings together, or **Discard** to
revert unsaved edits. Members can use the board and change states according to
the published workflow; they cannot open or edit the graph.

---

## What you design

| Piece                   | Meaning                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **States**              | Columns on that workflow’s board (for example To Do, In Progress, Done)                                                                                        |
| **Transitions (edges)** | Allowed moves from one state to another. Cycles need both directions as edges; a missing reverse edge blocks that move as not allowed (not a permission error) |
| **Type bindings**       | Which work-item types use this workflow                                                                                                                        |
| **Settings**            | Options for the selected state or transition (right-hand panel)                                                                                                |

Layout on the canvas is saved with the rules — moving boxes does not by itself
change what transitions are allowed until you **Save**.

---

## State settings

Select a state, then open **Settings**:

| Setting                       | What it does                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Name** / description        | Labels on the board and in pickers                                                                         |
| **Category**                  | Groups states for filters and reports (`todo`, `in progress`, `done`, …)                                   |
| **Lock record in this state** | While an item is here, most fields are read-only; changing state (for example reopen) can still be allowed |
| **Terminal state**            | No outbound transitions. If edges already leave this state, remove them before you can turn this on        |

Use the info icons for short explanations of each option.

---

## Transition settings

Select an edge between two states:

| Setting                 | What it does                                                                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Who can move**        | **Everyone**, or **Restricted** to roles, teams, or people                                                                                                                                                             |
| **Requires escalation** | Turn on when this move needs a form. Then **Create new…** or pick a form, open **Edit form**, click **Save** in the dialog, and **Save** the workflow                                                                  |
| **Resolution form**     | Named form people complete when taking this transition (required when escalation is on). Full editor opens in a dialog; changes apply only when you click **Save** there                                               |
| **Require children**    | **Off** — no check. **All complete** — all direct subtasks must be in a done category. **Match parent target** — all direct subtasks must already be in the parent’s target state (or same category when types differ) |

Edges into a typical **Done** category are seeded with **All complete** so
parents cannot close while subtasks are still open.

---

## Resolution forms

Create a **named** form (simple fields such as text, select, checkbox). Open
**Edit form** to configure it in a dialog:

- **Fields** — questions people answer on the move (use **+ Option** on Select
  fields for dropdown choices; checkboxes are on/off only).
- **Outcomes** — labeled choices they pick when finishing the form (recorded with
  the answers; routing by outcome comes later).
- **Preview** — how the form will look.
- **JSON** — advanced edit with line numbers and cursor **Ln / Col** readout.
  Leaving the editor formats, validates, and saves into the draft (duplicate
  field/outcome ids are re-issued). Parse errors show **Ln / Col** only. Click
  **Save** in the dialog, then **Save** the workflow. Past resolutions on work
  items keep a snapshot of answers/labels, so changing ids later does not break
  history.

When someone takes a transition that needs a form, work-item details (or the
board move) asks for **fields** and an **Outcome** before the status changes.

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
- Open **Alice** from the header while the designer is open — she docks as a
  right sidebar and can propose graph changes. Use **Apply** or **Reject** on
  the suggestion card. Apply needs the Workflow designer open on that project.
  If you have unsaved canvas edits, Alice saves them first, then applies. Ask
  Alice to undo or cancel a proposal you have not Applied yet to dismiss it
  without changing the canvas. See
  [Use the AI assistant](../chat/use-ai-assistant.md).

---

## Related

- [Board & planning](./README.md)
- [Kanban board](./kanban-board.md)
- [Assign and status](../work-items/assign-and-status.md)
- [Project settings](../projects/project-settings.md)
