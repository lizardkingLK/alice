# Workflow configuration

Status: **Plan** (product rules locked from brainstorm)

Replaces the custom **board column** designer with a directed **workflow graph**
(React Flow / XYFlow). Board columns become **states** of the active workflow.
Transition rules live on **edges**. Node and edge options live in a **Settings**
sidebar with info tooltips / click popovers.

When this feature ships, remove the board-specific designer UI and stop writing
board v1/v2 column documents. Until then,
[CUSTOM_BOARD_DESIGNER.md](../board/CUSTOM_BOARD_DESIGNER.md) remains the
implemented board config.

---

## Goals

- Design paths between states (not only columns + optional transition pairs).
- Support **cycles** (e.g. Dev ↔ QA) via explicit edges; ban self-loops and
  duplicate directed edges.
- Map **work-item types** to workflows; board uses a **workflow / type switcher**
  (parallel boards — model **C**).
- Auth on edges (`allowAnyOf`), escalation / resolution **presets**, child gates.
- Single-current work-item **`state`** JSONB + optional per-workflow history.
- Safe fallback: null / unparsable / schema conflict → **seeded default**
  workflow (and default board behavior) so the project never hard-crashes.
- Alice docked chat can propose designer changes with **Apply / Reject**.

## Non-goals (MVP)

- Category-wide edge seal (“lock entire category”) — **deferred (next)**
- Merged “All types” union board strip — **deferred (next)**
- Resolution outcome overriding edge target state — **deferred (next)**
- Cross-workflow shared presets — **deferred (next)**
- Full dynamic-fields engine inside resolution forms — **deferred (next)**
- Auto-migrate legacy board v1/v2 JSON into workflow docs (fallback to seeded
  default instead)

---

## Roles and multi-workflow rules

| Actor                                                                     | Can                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Project **manager** / **admin**                                           | Create / edit workflows, mark **default**, delete workflows, open Settings                                   |
| **Team manager** (project team “head” from team form — not a global role) | **Fork once** from default (or published parent); edit fork title, description, graph; **cannot fork again** |
| Member                                                                    | Use board / transitions per edge `allowAnyOf`; cannot edit workflow config                                   |

- `workflow_config` holds an envelope with `defaultWorkflowId` + `workflows[]`.
- Promoting a fork to default = **in-place swap** of `defaultWorkflowId`; the
  previous default stays in the array until explicitly deleted.
- Fork depth ≤ 1 (Zod + API).

---

## Board model (parallel boards)

1. Resolve work item **type** → workflow via `typeBindings`, else
   `defaultWorkflowId`.
2. Item has **one** current `{ workflowId, stateId, category }`.
3. Board chrome: **workflow / type switcher** — one tab (or select entry) per
   workflow that is default or has bindings.
4. Active switcher → columns = that workflow’s states; cards = types bound to
   that workflow (default also owns unbound types).
5. Wrong board ⇒ card filtered out (not shown in a foreign lane).
6. Persist switcher in URL / board defaults (same spirit as today’s filters).
7. Work-item details show **Workflow: {title}** and state from the item’s graph.
8. Mid-drag / PATCH validate against the **item’s** workflow + edge rules, not
   merely visible columns.
9. No “All types” merged strip in MVP.

Cross-project / “All projects” board continues to use a safe default strip (or
requires project scope) — same constraint as custom boards today.

---

## Graph rules

| Rule                     | Detail                                                                        |
| ------------------------ | ----------------------------------------------------------------------------- |
| Closed graph             | No edge ⇒ transition forbidden                                                |
| Cycles                   | Allowed when both directions are explicit edges                               |
| Self-loops               | Banned                                                                        |
| Duplicate directed edges | Banned (`A→B` at most once); `A→B` and `B→A` are fine                         |
| Layout                   | Separate JSON key from graph semantics (`graph` vs `layout`)                  |
| Draft                    | Pre-board / start: not a normal lane unless designer adds an equivalent state |

Shared client helpers cache allowed transitions; API remains source of truth.
Optimistic moves stay; conflicts surface for the user (toast / revert).

---

## State categories

Each state declares a **category** used for filters, charts (cross-project),
Done gates, and burndown-friendly queries:

| Category      | Typical use                        |
| ------------- | ---------------------------------- |
| `draft`       | Pre-board                          |
| `todo`        | Not started / queued               |
| `in_progress` | Active work                        |
| `done`        | Complete (`done_at` when entering) |

List / registry filters in MVP are **category-based**.

---

## Settings sidebar

Context-sensitive **Settings** panel (node vs edge) with info tooltips /
click popovers on every control.

### State node

| Control                       | Label (locked) | Effect                                                                                                                                           |
| ----------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Name / description            | —              | Display                                                                                                                                          |
| Category                      | —              | `draft` \| `todo` \| `in_progress` \| `done`                                                                                                     |
| Requires escalation           | —              | When true, every outbound edge must reference a resolution preset (Zod on save). Dialog runs **on exit**.                                        |
| **Lock record in this state** | Locked copy    | While here, record is read-only except state transitions (reopen pattern).                                                                       |
| **Terminal state**            | Locked copy    | No outbound edges. Checking it **blocks** until outbound edges are removed (confirm / “Remove all outbound and lock”). Never silent auto-delete. |

**Reopen:** allow an outbound edge from a done-category state while
**Lock record in this state** remains on (today’s Done behavior). Pure archive =
Lock record + Terminal.

### Edge

| Control              | Label / options (locked)                               | Effect                                                                                                                            |
| -------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `allowAnyOf`         | Role / team / user matchers                            | Who may take the transition (default: all project members if empty — product default TBD at impl; document chosen default in Zod) |
| Resolution preset    | Load / create named preset                             | Optional; required if source node requires escalation                                                                             |
| **Require children** | **Off** \| **All complete** \| **Match parent target** | See below                                                                                                                         |

**Require children**

| Value                   | Rule                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Off**                 | No child check                                                                                                |
| **All complete**        | Every direct child is in a **done-category** state (in the child’s own workflow)                              |
| **Match parent target** | Every direct child is already in the parent’s **target** state id, or same **category** when workflows differ |

Seed default workflow: edges into `category: done` get **All complete** so
behavior matches today’s Done gate.

---

## Resolution presets (MVP)

Named forms live in `resolutionPresets[]` on each workflow document.

- Designer: **Form** | **Preview** | **JSON** (round-trip; Zod on save).
- MVP field types: `text`, `textarea`, `select`, `checkbox` (no full dynamic-fields system).
- Outcomes: `{ id, label }` — audit / reason; edge target still wins in MVP.
- Edge stores `resolutionPresetId`. First save-with-name of an edge-local draft
  **promotes** into `resolutionPresets`.
- **Load preset** reuses an existing preset; **Save as…** clones a new id when
  needed.
- Presets are **mutable in place**; activity stores a **snapshot** at resolve time.
- Presets are **per workflow** (fork copies them).

---

## Document shape (sketch)

```json
{
  "schemaVersion": 1,
  "defaultWorkflowId": "wf-default",
  "workflows": [
    {
      "id": "wf-default",
      "title": "Default",
      "description": "",
      "forkedFromId": null,
      "typeBindings": ["Story", "Task"],
      "graph": {
        "states": [
          {
            "id": "todo",
            "name": "To Do",
            "category": "todo",
            "lockRecord": false,
            "terminal": false,
            "requiresEscalation": false
          }
        ],
        "edges": [
          {
            "id": "e1",
            "from": "dev",
            "to": "done",
            "allowAnyOf": [],
            "resolutionPresetId": null,
            "requireChildren": "all_complete"
          }
        ]
      },
      "layout": { "nodes": {}, "edges": {} },
      "resolutionPresets": []
    }
  ]
}
```

`requireChildren`: `off` | `all_complete` | `match_parent_target`.

Fallback: `null`, parse failure, or Zod failure → **seeded default** workflow
document (and default board lanes). Optional manager-only soft notice later.

---

## Work item `state` JSONB

Single-current placement (not a live map of every workflow):

```json
{
  "workflowId": "wf-bug",
  "stateId": "testing",
  "category": "in_progress",
  "historyByWorkflow": {
    "wf-default": { "stateId": "todo", "updatedAt": "…" }
  }
}
```

| Field                    | Role                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| `workflowId` + `stateId` | Source of truth for board placement and transitions                    |
| `category`               | Denormalized for filters, gates, cross-project charts                  |
| `historyByWorkflow`      | Optional memory on type / binding change — not simultaneous membership |

Compatibility window: keep deriving legacy `work_items.status` + `done_at` on
transition where needed; thin callers toward `state` / category.
Prefer trigger-maintained or generated columns (`state_workflow_id`,
`state_id`, `status_category`) for indexes and chart rollups (**Step 7**).
Retire `board_column_id` in favor of `stateId`.

### As-built — `work_items.state` (Step 1)

| Item     | Detail                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| Column   | `work_items.state` `Json?` / JSONB (migration `add_work_items_state`)                                                    |
| Shape    | Zod `workItemStateSchema` in `packages/types/src/work-item-state.ts`                                                     |
| Helpers  | `buildWorkItemStateFromLegacy`, `resolveWorkItemState`, `syncWorkItemStateForStatusChange`, `doneAtForCategoryChange`, … |
| Writers  | Create/update dual-write `state` (+ category-based `done_at`) in work-items repository                                   |
| Fallback | Null/invalid `state` → derive from `status` (+ optional `board_column_id`)                                               |

Parallel boards do **not** mean two live states on one card.

---

## Charts and filters

| Scope                       | Aggregation                                                        |
| --------------------------- | ------------------------------------------------------------------ |
| List / filters              | **Category**                                                       |
| Charts — no / multi project | **Category**                                                       |
| Charts — single project     | **Category** + new **State** dimension (workflow state ids/labels) |

Extend `work_item_chart_rollups` (or sibling grain) with category always and
`workflow_id` + `state_id` for project-scoped state slices. Charts UI gains a
**State** label when a project is selected.

---

## Activity vs worklogs

- **`work_item_worklogs`**: time only (already).
- **`activities`**: implement per [ACTIVITY.md](../work-items/ACTIVITY.md); extend with:

| `action`              | Notes                                                        |
| --------------------- | ------------------------------------------------------------ |
| `workflow_transition` | `fromStateId`, `toStateId`, `workflowId`, `edgeId` in `meta` |
| `escalation_resolved` | Preset id/version snapshot, outcome, field answers           |

Notifications stay separate (inbox). Writers on the same API path as the
transition PATCH.

---

## Alice chat (designer)

- Replace floating **drawer** with a **docked** right sidebar that consumes
  layout width (designer + chat side-by-side).
- Inject **view context**: page, `projectId`, `surface: 'workflow-designer'`,
  `workflowId`, `isDirty`, schema version.
- Tools (function calls): read config, **propose** patch (no write),
  **apply** only after confirm, validate with Zod.
- Confirm UX: **inline Apply / Reject card** (no modal for apply). Destructive
  ops may still use existing confirm dialogs elsewhere.
- If canvas **dirty**: save current designer state first (same save path),
  without full page reload → Apply → reload config into live canvas.
  Show Saving… → Applying… → Done; on Apply failure keep saved graph and show
  errors on the card.
- Transparency: human summary + optional expandable JSON patch/diff.
- Domain services still enforce manager/admin and fork-depth rules.

Evolve / replace `configure_board_draft` with workflow-aware tools when
implemented. See [AI_CHATBOT.md](../chat/AI_CHATBOT.md).

---

## Status / state pickers (app-wide)

Replace global `WORK_ITEM_STATUSES` menus with **workflow states** for the
item’s resolved workflow (details, backlog sheet, create-from-column, etc.),
using the same allowed-transition helpers and auth as the board.

---

## Deferred (next) — not MVP

Documented for the implementation plan “Next” section; do not block MVP:

1. **Category lock** — seal all states in a category (internal edges OK;
   cross-category outbound forbidden) with remove-edges confirm.
2. **All-types union board** — optional read-only merged strip.
3. **Outcome → target state** on resolution presets.
4. **Cross-workflow preset library**.
5. **Full dynamic fields** inside resolution form designer.
6. **Auto-migrate** legacy board v1/v2 JSON into workflow documents.
7. Explicit **optimistic concurrency** / version field on workflow docs
   (call out at impl if concurrent editors matter).

---

## User-facing docs

- [Workflow designer](../../user-guide/board-and-planning/workflow-designer.md)
  (`minimumRole`: manager)
- [Kanban board](../../user-guide/board-and-planning/kanban-board.md)
- [Assign and status](../../user-guide/work-items/assign-and-status.md)
- [Use AI assistant](../../user-guide/chat/use-ai-assistant.md) (docked sidebar
  - designer Apply/Reject)
