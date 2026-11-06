# Worklog Excel upload development guide

## API contract

All routes are mounted under `/api/worklogs` and `/api/v1/worklogs`.

| Method | Path        | Request                                | Success response        |
| ------ | ----------- | -------------------------------------- | ----------------------- |
| GET    | `/template` | Authenticated                          | Excel workbook blob     |
| POST   | `/preview`  | Multipart `work_item_id` and `file`    | `{ row_count, rows[] }` |
| POST   | `/import`   | Same multipart body after confirmation | `{ imported_count }`    |

Preview rows use `row_number`, `start_at`, `end_at`, `logged_hours`, and
`description`. Validation failures use `errors[]` with `row_number`, optional
`field`, and `message`.

## Code map

- Workbook parser/template: `apps/api/src/routes/api/worklogs/worklogs.excel.ts`
- Authenticated routes: `apps/api/src/routes/api/worklogs/worklogs.route.ts`
- Permission and Done checks: `apps/api/src/routes/api/worklogs/worklogs.service.ts`
- Atomic insert: `apps/api/src/routes/api/worklogs/worklogs.repository.ts`
- Shared wire types: `packages/types/src/api/v1/work-item-worklogs.ts`
- Client API calls: `apps/web/app/worklogs/_services/worklogs.mutations.client.ts`
- Upload dialog: `apps/web/app/work-items/_components/work-item-work-logs/work-item-work-log-excel-dialog.tsx`
- Manual time calculation: `apps/web/app/work-items/_helpers/work-item-work-log-time.ts`
- Work-item integration: `work-item-details.tsx` and `work-item-activity-tabs.tsx`

The authenticated fetch helper supports `responseType: 'blob'` for the template
and preserves structured API `errors` on `ApiError.details` for row rendering.

## State and refresh behavior

Selecting a valid file immediately calls preview. Import stays disabled until a
preview succeeds. The first import action changes the dialog to confirmation;
only **Confirm import** calls the mutation.

After success, `router.refresh()` reloads server worklogs. The parent owns one
`workLogs` array used by the Work Log panel and Time Tracking sidebar, so both
views update from the same refreshed data. Realtime worklog inserts continue to
merge into that state.

## Manual entry mapping

`calculateWorkLogEntry` calculates browser-local elapsed time, including
overnight entries. The create request maps:

- elapsed hours to `logged_hours`
- the selected start calendar date to `logged_at`
- description to `comment`

Do not prefill an edit form from `logged_at`: historical rows do not contain a
reliable start/end pair.

## Tests

Run focused frontend coverage:

```text
pnpm --filter web test -- tests/work-items/work-item-work-log-time.test.ts tests/work-items/work-item-work-log-dialog.test.tsx tests/work-items/work-item-work-log-excel-dialog.test.tsx tests/worklogs/worklogs.mutations.client.test.ts
```

Also run the API worklog suite, frontend lint, and both API/web TypeScript
checks when changing the contract.
