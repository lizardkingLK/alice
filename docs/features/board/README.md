# Board feature documentation

Kanban board for work items by status / workflow state. Draft items are excluded
from the board unless a future workflow exposes an equivalent state.

| Document                                               | Description                                                                                                                                  | Status                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| [CUSTOM_BOARD_DESIGNER.md](./CUSTOM_BOARD_DESIGNER.md) | Historical custom column designer (v1/v2 `workflow_config` columns)                                                                          | **Retired / historical** |
| —                                                      | Kanban board runtime — described in the [ARD](../../product/ARD.md) and [TRD](../../architecture/TRD.md); add dedicated notes here as needed | Living                   |

> **Configuration successor:** [Workflow](../workflow/) is the only project
> configuration surface for boards/states. The Board designer UI and Alice
> `configure_board_draft` tools were removed in workflow **Step 9**. Runtime
> reads still fall back safely for legacy v1/v2 column JSON. See
> [WORKFLOW_IMPLEMENTATION_PLAN.md](../workflow/WORKFLOW_IMPLEMENTATION_PLAN.md).

Quick links:

- Implementation: `apps/web/app/board/`
- Shared applied-filter badges: `apps/web/components/applied-filter-badges.tsx`
  (inline toolbar row + horizontal ScrollArea; debounced batched chip dismiss)
- Work item status updates: `apps/api/src/routes/api/work-items/`
- Related: [work items](../work-items/), [workflow](../workflow/),
  [sprints](../sprints/),
  [user guide — Kanban board](../../user-guide/board-and-planning/kanban-board.md),
  [user guide — Workflow designer](../../user-guide/board-and-planning/workflow-designer.md)

Toolbar filters: search, Filter dialog (project / sprint / priority / **labels**; **Set as default** on Project / Sprint), assignee avatars, then applied-filter badges (per-chip dismiss + clear-all icon) when concrete URL filters are active (All projects / All sprints are not shown as chips). Chip dismiss is optimistic and debounced into one `onRemove(ids)` / navigation. Shared Filter shell (`filter-dialog-shell.tsx`) uses a large two-pane layout; Sprint options are grouped by project in auto-expanded collapsibles, and option search hides non-matching rows (and empty groups). Missing localStorage defaults means All/All (no first-visit prompt).
