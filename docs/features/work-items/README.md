# Work items feature documentation

| Document                                                            | Description                                                  | Status      |
| ------------------------------------------------------------------- | ------------------------------------------------------------ | ----------- |
| [WORK_ITEM_DESCRIPTION.md](../../database/WORK_ITEM_DESCRIPTION.md) | TipTap / ProseMirror JSON stored in `work_items.description` | Living      |
| [ATTACHMENTS.md](./ATTACHMENTS.md)                                  | Private Storage attachments, SSR list, signed URLs on click  | Implemented |
| [ACTIVITY.md](./ACTIVITY.md)                                        | Work-item activity timeline next to Discussion               | Plan        |

Quick links:

- Implementation: `apps/web/app/work-items/`
- Client services: `apps/web/app/work-items/_services/workItem.service.client.ts`
- Server reads: `apps/web/app/work-items/_services/workItem.service.server.ts`
- API: `apps/api/src/routes/api/workItems/`
- Schema: `work_items` in `packages/db/prisma/schema.prisma`
- Shared hierarchy helpers: `packages/types/src/work-item-types.ts`
- Related: [board](../board/), [database ER diagram](../../database/ER_DIAGRAM.md)
- Testing guide: [TESTING_DEVELOPMENT_FLOW.md](../../guides/TESTING_DEVELOPMENT_FLOW.md)

## Types and hierarchy

`WorkItemType` values: **Epic**, **Story**, **Task**, **Issue**.

Subtasks use self-referential `work_items.parent_id`. Allowed child types:

| Parent | Allowed child                |
| ------ | ---------------------------- |
| Epic   | Story                        |
| Story  | Task                         |
| Task   | Issue                        |
| Issue  | _(leaf — no Create Subtask)_ |

Rules enforced on API create/update when `parent_id` is set:

- Parent must exist
- Child must be in the same project
- Child `type` must match the table above
- A work item cannot be its own parent

On the work-item details page, **Create subtask** opens the shared create form with project and type locked, submits `parent_id`, then refreshes. The **Subtasks** section lists children (`parent_id = current item`). Linked issues remain a separate non-hierarchy feature.

## Unit tests (Vitest)

P0 component coverage lives under `apps/web/tests/work-items/`:

| Spec                        | SUT               | Focus                                                                       |
| --------------------------- | ----------------- | --------------------------------------------------------------------------- |
| `workItem-form.test.tsx`    | `WorkItemForm`    | Create/edit submit, subtask `parent_id` / locked type, errors, cancel       |
| `workItem-details.test.tsx` | `WorkItemDetails` | Create subtask dialog, leaf Issue hide, Subtasks list, refresh after create |
| `workItems-table.test.tsx`  | `WorkItemsTable`  | Row render, “You” badge, empty state, search, pagination, dialogs           |

Shared fixtures/mocks used by these suites:

- `apps/web/tests/factories/` — `user`, `project`, `workItem`, `pagination`
- `apps/web/tests/mocks/` — `next-navigation`, `dropdown-menu`

Follow `.cursor/rules/08-qa-dev-manager.mdc` when extending coverage (badges, title editor, description helpers next).
