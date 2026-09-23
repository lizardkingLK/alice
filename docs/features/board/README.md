# Board feature documentation

Kanban board for work items by status (`New`, `ToDo`, `InProgress`, `Testing`, `Done`). Draft items are excluded from the board.

| Document                                               | Description                                                                                                                             | Status      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| [CUSTOM_BOARD_DESIGNER.md](./CUSTOM_BOARD_DESIGNER.md) | Custom column designer — named columns, multi-status mapping, validation rules, Alice draft integration                                 | Implemented |
| —                                                      | Board behavior is described in the [ARD](../../product/ARD.md) and [TRD](../../architecture/TRD.md); add dedicated notes here as needed | Living      |

Quick links:

- Implementation: `apps/web/app/board/`
- Shared applied-filter badges: `apps/web/components/applied-filter-badges.tsx`
  (inline toolbar row + horizontal ScrollArea; debounced batched chip dismiss)
- Work item status updates: `apps/api/src/routes/api/workItems/`
- Related: [work items](../work-items/), [sprints](../sprints/), [user guide — Kanban board](../../user-guide/board-and-planning/kanban-board.md)

Toolbar filters: search, Filter dialog (project / sprint / priority / **labels**), Defaults, assignee avatars, then applied-filter badges (per-chip dismiss + clear-all icon) when non-default filters are active. Chip dismiss is optimistic and debounced into one `onRemove(ids)` / navigation.
