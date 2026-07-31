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

On the work-item details page:

- **Create subtask** (header) opens the shared create form with project and type locked, submits `parent_id`, then refreshes.
- **+** in the **Subtasks** section opens **Link Subtask**: pick an existing unparented work item of the allowed child type in the same project, then PATCH its `parent_id`. Only orphans (`parent_id IS NULL`) appear in v1 (no reparenting).

The **Subtasks** section lists children (`parent_id = current item`). The progress bar is the **average** of each child's status completion weight (`Draft`/`New`/`ToDo` 0%, `InProgress` 25%, `Testing` 75%, `Done` 100%), rounded. Linked issues remain a separate non-hierarchy feature.

The in-page path above the title (`WorkItemPathBreadcrumb`) shows hierarchy ancestors when present: `PROJECT > Sprint > [Epic] … > [Type] SHORT_ID`. Ancestor segments link to the parent work-item details pages; the current item is not a link.

The dashboard shell breadcrumb on work-item detail is always project-scoped when the item has a `project_id`: `Dashboard → Projects → {project} → Work Items → {item}`. Entry query flags (`fromProject` / `fromAssignee`) are not used for that trail — use the browser back button for navigation history.

## Unit tests (Vitest)

P0 component coverage lives under `apps/web/tests/work-items/`:

| Spec                                     | SUT                         | Focus                                                                 |
| ---------------------------------------- | --------------------------- | --------------------------------------------------------------------- |
| `workItem-form.test.tsx`                 | `WorkItemForm`              | Create/edit submit, subtask `parent_id` / locked type, errors, cancel |
| `workItem-details.test.tsx`              | `WorkItemDetails`           | Create vs link dialogs, leaf Issue hide, Subtasks list, refresh       |
| `work-item-link-subtask-dialog.test.tsx` | `WorkItemLinkSubtaskDialog` | PATCH `parent_id`, empty candidates                                   |
| `work-item-path-breadcrumb.test.tsx`     | `WorkItemPathBreadcrumb`    | Root path, parent link, full Epic→Story→Task→Issue ancestor chain     |
| `workItems-table.test.tsx`               | `WorkItemsTable`            | Row render, “You” badge, empty state, search, pagination, dialogs     |

Shared fixtures/mocks used by these suites:

- `apps/web/tests/factories/` — `user`, `project`, `workItem`, `pagination`
- `apps/web/tests/mocks/` — `next-navigation`, `dropdown-menu`

Follow `.cursor/rules/08-qa-dev-manager.mdc` when extending coverage (badges, title editor, description helpers next).
