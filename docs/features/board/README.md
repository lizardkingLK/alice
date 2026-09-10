# Board feature documentation

Kanban board for work items by status (`New`, `ToDo`, `InProgress`, `Testing`, `Done`). Draft items are excluded from the board.

| Document                                               | Description                                                                                                                             | Status |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| [CUSTOM_BOARD_DESIGNER.md](./CUSTOM_BOARD_DESIGNER.md) | Custom column designer — named columns, multi-status mapping, validation rules, Alice bot integration                                   | Plan   |
| —                                                      | Board behavior is described in the [ARD](../../product/ARD.md) and [TRD](../../architecture/TRD.md); add dedicated notes here as needed | Living |

Quick links:

- Implementation: `apps/web/app/board/`
- Kanban component: `apps/web/app/board/_components/kanban-board.tsx`
- Status enum: `packages/types/src/work-item-status.ts`
- Board config storage: `projects.workflow_config` in `packages/db/prisma/schema.prisma`
- Work item status updates: `apps/api/src/routes/api/workItems/`
- Related: [work items](../work-items/), [sprints](../sprints/), [projects](../projects/)
