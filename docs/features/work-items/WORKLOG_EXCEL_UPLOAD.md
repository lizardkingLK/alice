# Worklog Excel upload

GI-648 adds template download, validation preview, atomic import, and work-item
detail UI for `.xlsx` worklogs.

## Product contract

- Upload starts from one work-item details page.
- Every imported row belongs to that work item and the authenticated user.
- Files are limited to `.xlsx`, 2 MB, and 200 nonblank data rows.
- The complete file is rejected when any row is invalid.
- Project membership is required and Done items reject new worklogs.
- Imported rows appear in the Work Log table and Time Tracking totals.

## Workbook contract

The `Worklogs` sheet contains exactly these columns:

1. `Start Date/Time`
2. `End Date/Time`
3. `Description`

Excel date cells and offset-free text use UTC. Explicit ISO offsets are converted
to UTC. End must be later than start, duration must not exceed 1,000 hours, and
description must not exceed 2,000 characters. Blank rows are ignored.

## UI flow

The Work Log tab exposes **Download template** and **Excel upload**. The upload
dialog accepts browse or drag-and-drop, previews UTC start/end values and
calculated hours, lists server errors with Excel row numbers, and requires a
second confirmation before import.

After success, the work-item route refreshes. The shared `workLogs` state then
feeds both the table and `WorkItemTimeTracking`, while realtime inserts remain a
parallel refresh path.

Manual creation uses browser-local start/end `datetime-local` controls to
calculate elapsed hours. It sends only the calculated `logged_hours`, the start
calendar date as `logged_at`, and the description. The selected timestamps are
not persisted.

## Data model limitation

`work_item_worklogs` stores `logged_hours`, `logged_at`, and `comment`; it has no
start/end timestamp columns. The import stores the parsed start timestamp in
`logged_at` and uses the end timestamp only for duration calculation.

There is no authenticated worklog update API. An edit UI would be misleading
because existing rows cannot reconstruct start/end values. Update support needs
a separate API/product contract and, if exact timestamps must survive, a schema
decision outside GI-648 Phase 3.

## Security and failure behavior

- All three endpoints require API authentication.
- Preview and import reuse work-item project membership and Done-item checks.
- Import uses one Prisma transaction and saves nothing after validation or
  persistence failure.
- The UI displays 400 validation details, 403 permission messages, file-limit
  errors, and network/session failures without enabling import.

See the [developer guide](../../guides/WORKLOG_EXCEL_UPLOAD_DEVELOPMENT.md) for
the API and code map.
