# Work items feature documentation

| Document                                                            | Description                                                  | Status      |
| ------------------------------------------------------------------- | ------------------------------------------------------------ | ----------- |
| [WORK_ITEM_DESCRIPTION.md](../../database/WORK_ITEM_DESCRIPTION.md) | TipTap / ProseMirror JSON stored in `work_items.description` | Living      |
| [ATTACHMENTS.md](./ATTACHMENTS.md)                                  | Private Storage attachments, SSR list, signed URLs on click  | Implemented |
| [LABELS.md](./LABELS.md)                                            | JSONB text-array labels, create/details edit, search UX      | Implemented |
| [ACTIVITY.md](./ACTIVITY.md)                                        | Work-item activity timeline next to Discussion               | Plan        |

Quick links:

- Implementation: `apps/web/app/work-items/`
- Client services: `apps/web/app/work-items/_services/workItem.service.client.ts`
- Server reads: `apps/web/app/work-items/_services/workItem.service.server.ts`
- Retrieval toggle (Plan): [DATA_RETRIEVAL.md](../../architecture/DATA_RETRIEVAL.md) — list/detail can switch to Express Prisma GETs; default remains SSR
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
- Each subtask row has an **Unlink** control (`Unlink2` icon). Confirming clears `parent_id` so the item is orphaned again and can be re-linked via **+**.

The **Subtasks** section lists children (`parent_id = current item`). **Order by** sorts the table client-side by None, Title, Priority, or Assignee with A–Z / Z–A direction. The progress bar is the **average** of each child's status completion weight (`Draft`/`New`/`ToDo` 0%, `InProgress` 25%, `Testing` 75%, `Done` 100%), rounded. Linked issues remain a separate non-hierarchy feature.

The in-page path above the title (`WorkItemPathBreadcrumb`) shows hierarchy ancestors when present: `PROJECT > Sprint > [Epic] … > [Type] SHORT_ID`. Ancestor segments link to the parent work-item details pages; the current item is not a link.

The dashboard shell breadcrumb on work-item detail is always project-scoped when the item has a `project_id`: `Dashboard → Projects → {project} → Work Items → {item}`. Entry query flags (`fromProject` / `fromAssignee`) are not used for that trail — use the browser back button for navigation history.

## List views (Flat vs Hierarchy)

`WorkItemsTable` (used on `/work-items`, My Work `/member`, and the project **Work items** tab) supports a URL toggle:

| `view` query        | Behavior                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------- |
| _(absent)_ / `flat` | Default: paginated flat list of all matching work items                                   |
| `hierarchy`         | Paginated **roots only** (`parent_id IS NULL`); expand a row to lazy-load direct children |

Toolbar:

- **Flat / Hierarchy** segmented control writes `view` and resets `page=1`
- In hierarchy mode: **Expand all** recursively loads children for expandable types on the current page; **Collapse all** hides nested rows
- Filters (project, sprint, type, assignee, search) apply to the **root query** only; expanded children are not re-filtered so the tree stays coherent

Chevron affordances follow `getAllowedChildType` (Epic / Story / Task). Issues are leaves.

## Done status gates

### Incomplete subtasks (implemented)

A work item **cannot** move to **Done** while any **direct** child (`parent_id = this item`) has a status other than `Done`.

- **UI (details sidebar):** choosing Done opens an acknowledgment dialog (`IncompleteSubtasksDoneBlockedDialog`) — OK only; no force-through. Complete or unlink incomplete children first.
- **API:** `PATCH` that sets `status` to `Done` counts incomplete children and returns **400** (`WorkItemValidationError`) when the count is > 0. Already-Done items are not re-validated on no-op updates.

### Incomplete blocker linked issues (planned)

The same acknowledgment pattern will apply when linked issues with a **blocks** relationship are not Done. Not enforced yet — document only until link-type / blocker UX ships.

### Done → read-only except Status (implemented)

When `status === Done`, the details record is **read-only except Status** (so the item can be reopened):

- **UI:** hide title / description / assignee / reporter edits, Attach, Create/Link/Unlink subtask, attachment upload/delete, and work-log form. Status dropdown stays available.
- **API:** `PATCH` rejects non-status field changes on Done items (**400**). Creating work logs on Done items is also rejected. Discussion/comments remain allowed.

## Unit tests (Vitest)

P0 component coverage lives under `apps/web/tests/work-items/`:

| Spec                                          | SUT                            | Focus                                                                 |
| --------------------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| `workItem-form.test.tsx`                      | `WorkItemForm`                 | Create/edit submit, subtask `parent_id` / locked type, errors, cancel |
| `workItem-details.test.tsx`                   | `WorkItemDetails`              | Create vs link vs unlink, leaf Issue hide, Subtasks list, refresh     |
| `work-item-link-subtask-dialog.test.tsx`      | `WorkItemLinkSubtaskDialog`    | PATCH `parent_id`, empty candidates                                   |
| `work-item-unlink-subtask-dialog.test.tsx`    | `WorkItemUnlinkSubtaskDialog`  | Confirm clears `parent_id`; cancel does nothing                       |
| `workItem-details-sidebar-done-gate.test.tsx` | `WorkItemSidebar`              | Block Done when incomplete subtasks; allow when all Done / none       |
| `workItem-title-editor.test.tsx`              | `WorkItemTitleEditor`          | Hide edit control when Done (`readOnly`)                              |
| `work-item-path-breadcrumb.test.tsx`          | `WorkItemPathBreadcrumb`       | Root path, parent link, full Epic→Story→Task→Issue ancestor chain     |
| `workItems-table.test.tsx`                    | `WorkItemsTable`               | Row render, view toggle, hierarchy expand/collapse, filters, dialogs  |
| `work-item-hierarchy-rows.test.ts`            | `flattenWorkItemHierarchyRows` | Root flatten, expanded children, leaf Issues                          |

Shared fixtures/mocks used by these suites:

- `apps/web/tests/factories/` — `user`, `project`, `workItem`, `pagination`
- `apps/web/tests/mocks/` — `next-navigation`, `dropdown-menu`

Follow `.cursor/rules/08-qa-dev-manager.mdc` when extending coverage (badges, title editor, description helpers next).
