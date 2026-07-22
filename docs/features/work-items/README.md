# Work items feature documentation

| Document                                                            | Description                                                  | Status |
| ------------------------------------------------------------------- | ------------------------------------------------------------ | ------ |
| [WORK_ITEM_DESCRIPTION.md](../../database/WORK_ITEM_DESCRIPTION.md) | TipTap / ProseMirror JSON stored in `work_items.description` | Living |

Quick links:

- Implementation: `apps/web/app/work-items/`
- Client services: `apps/web/app/work-items/_services/workItem.service.client.ts`
- Server reads: `apps/web/app/work-items/_services/workItem.service.server.ts`
- API: `apps/api/src/routes/api/workItems/`
- Schema: `work_items` in `packages/db/prisma/schema.prisma`
- Related: [board](../board/), [database ER diagram](../../database/ER_DIAGRAM.md)
- Testing guide: [TESTING_DEVELOPMENT_FLOW.md](../../guides/TESTING_DEVELOPMENT_FLOW.md)

## Unit tests (Vitest)

P0 component coverage lives under `apps/web/tests/work-items/`:

| Spec                       | SUT              | Focus                                                             |
| -------------------------- | ---------------- | ----------------------------------------------------------------- |
| `workItem-form.test.tsx`   | `WorkItemForm`   | Create/edit submit, service errors, cancel, button labels         |
| `workItems-table.test.tsx` | `WorkItemsTable` | Row render, “You” badge, empty state, search, pagination, dialogs |

Shared fixtures/mocks used by these suites:

- `apps/web/tests/factories/` — `user`, `project`, `workItem`, `pagination`
- `apps/web/tests/mocks/` — `next-navigation`, `dropdown-menu`

Follow `.cursor/rules/08-qa-dev-manager.mdc` when extending coverage (badges, title editor, description helpers next).
