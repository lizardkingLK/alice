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

| Piece                   | Meaning                                                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **States**              | Columns on that workflow’s board (for example To Do, In Progress, Done)                                                                                                                                               |
| **Transitions (edges)** | Allowed moves from one state to another. Cycles need both directions as edges; a missing reverse edge blocks that move as not allowed (not a permission error)                                                        |
| **Type bindings**       | Which work-item types use this workflow. The project **default** also owns any unbound types. **Mark default** moves bindings from the previous default onto the new one so types do not stay stuck on the old graph. |
| **Settings**            | Options for the selected state or transition (right-hand panel)                                                                                                                                                       |

Layout on the canvas is saved with the rules — moving boxes does not by itself
change what transitions are allowed until you **Save**.

---

## Edit the graph

Managers and admins can change the graph on the canvas (Alice remains an
optional alternate path):

1. Press **Ctrl/Cmd+Alt+N** to add a state (opens Settings so you can rename
   it), or right-click the canvas and choose **Add state**.
2. Drag from a handle on one state to a handle on another to create a
   transition (handles sit on all four sides; they stay hidden until you hover
   or select a state, start a connection, or an edge already uses that port).
   Your chosen handles are kept; otherwise the canvas picks short sides (and
   uses the free top/bottom ports for a return edge when both directions
   exist). Forward (left-to-right) links use the primary green stroke; reverse
   (right-to-left) links use a dark stroke. Self-loops and duplicate pairs are
   rejected.
3. To move a transition’s connection points without losing Settings, select the
   edge and drag either end to another handle on the **same** two states
   (reconnect). Changing which states are linked still requires delete + create.
4. Select a state or transition and use **Delete state** / **Delete
   transition** in Settings, or press **Delete** / **Backspace** (no confirm).
5. Name and category changes in Settings update the canvas node immediately.
6. Click **Save** to publish graph and Settings together, or **Discard** to
   revert unsaved edits.
7. If you **delete a state** that still has work items, Save is blocked. A
   dialog lists each removed state and how many items use it. Choose a
   remaining state for those items and **Move and save**, or **Discard
   changes** to keep the previous graph.

Use the **Kanban** icon in the toolbar to open this project’s **Board**. Open
**Help** (?) for the full keyboard list, or **right-click** the canvas for the
same commands with shortcuts shown.

### Keyboard

| Shortcut                   | Action                                                |
| -------------------------- | ----------------------------------------------------- |
| **Ctrl/Cmd+Alt+N**         | Add a new state                                       |
| **Ctrl/Cmd+C**             | Copy selected state (transitions are not kept)        |
| **Ctrl/Cmd+X**             | Cut selected state (transitions are not kept)         |
| **Ctrl/Cmd+V**             | Paste a copied or cut state as a new state (no edges) |
| **Ctrl/Cmd+Z**             | Undo the last designer change                         |
| **Delete** / **Backspace** | Delete selected state or transition (no confirm)      |
| **Esc**                    | Clear selection                                       |

---

## State settings

Select a state, then open **Settings**:

| Setting                       | What it does                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Name** / description        | Labels on the board and in pickers (updates the canvas node live)                                          |
| **Category**                  | Groups states for filters and reports (`todo`, `in progress`, `done`, …); updates the node live            |
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

Next to the workflow switcher:

| Action           | What it does                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**        | Rename the active workflow (saved with the envelope)                                                                                                                                    |
| **Fork**         | Copy the active workflow into a new editable fork (disabled on an existing fork)                                                                                                        |
| **Mark default** | Make the active workflow the project default (disabled when it already is). Also moves the previous default’s type bindings here and reassigns work items that were on the old default. |
| **Delete**       | Remove a non-default workflow when more than one exists (confirm first; promote another default first). That workflow’s type bindings and work items move to the project default.       |

- A **team manager** (set on the project team) may **fork** once via the same
  control; that fork cannot be forked again. Forks start with **no** type
  bindings until you mark them default (or bind types later).
- Unsaved canvas edits are saved before Fork / Mark default / Delete so the
  server stays in sync.

If configuration is missing or invalid, the project safely uses a **seeded
default** workflow so the board keeps working.

---

## Board and Alice

- On the **Board**, columns follow the project default workflow, or
  `?workflow=<id>` when set. See [Kanban board](./kanban-board.md).
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
