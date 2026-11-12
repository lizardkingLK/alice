# Notifications

Per-user in-app inbox in the dashboard header bell and the full
`/notifications` page.

| Field        | Value                                                                   |
| ------------ | ----------------------------------------------------------------------- |
| Status       | **Living**                                                              |
| Last updated | 2026-11-11                                                              |
| Scope        | Header inbox, `/notifications` page, `notifications` table, daily crons |

## Behavior

- Each row belongs to one `user_id`. There is no “read by all users” flag.
- **Deferred (post-W6):** optional `silent` (or equivalent) so board
  status/move events can ride the notification pipeline without appearing in
  the header inbox. Board sync itself uses `work_items` realtime (see
  [REALTIME_BOARD_MOVES.md](../board/REALTIME_BOARD_MOVES.md)); silent inbox
  rows are not required for that.
- The dashboard header does **not** block page render on the inbox query.
  `NotificationInbox` loads the latest 50 active rows on the client after mount
  and can retry if the request fails (slow networks, timeouts).
- The full inbox at `/notifications` uses the same actions (mark read, archive,
  realtime) with a higher limit (100). Sidebar **Notifications** and the expand
  control on the header bell both open that route.
- Realtime inserts/updates/deletes still arrive over Supabase while signed in.
- Bell badge: numeric unread count through 9; a star when unread is 10 or more.

## Daily reminders cron

`GET /api/notifications/daily-reminders` (Vercel cron; authorize with
`Authorization: Bearer <CRON_SECRET>` when set) runs **two jobs in parallel**:

1. **Due dates** — same logic as `GET /api/notifications/check-due-dates`
   (today + tomorrow, non-Done assigned items → `due_date` rows).
2. **Worklog burndown gaps** — RPC `get_worklog_burndown_pending(p_as_of)`
   returns assignees behind today’s linear ideal spend on active sprints.
   Only rows with `pending_hours > 0` become `worklog_pending` inbox messages
   (one per assignee per day; pending hours summed across sprints).

`GET /api/notifications/check-due-dates` remains for due-date-only runs.
Point the deployed schedule at **`daily-reminders`**.

### Worklog pending math

Per assignee × active sprint (non-Done assigned items):

- `estimated_points` = Σ `COALESCE(story_points, 0)` (1 point ≈ 1 hour)
- `logged_hours` = Σ active worklogs on those items through `p_as_of`
- `ideal_spent_eod` = linear spend for `p_as_of` (same slope as
  `computeBurndownIdeal`)
- `pending_hours` = `max(0, ideal_spent_eod − logged_hours)`

Example copy: _You're about 3 hours behind today's ideal pace — log work to
catch up._

## Retention

Daily cron `GET /api/notifications/prune-read` (Vercel, `30 4 * * *`) deletes
rows that are **older than 30 days** and either:

- `read_status = true`, or
- `status = archived`

Unread active rows are kept. Requires `Authorization: Bearer <CRON_SECRET>`
when that env var is set (same as daily-reminders cron).

## Schema

Inbox list filter: `user_id` + `status = active`, newest `created_at`, limit 50
(header) / 100 (page). Index: `notifications_user_id_status_created_at_idx`.

## Async archive / purge

Destructive soft-archive and hard-purge mutations return **202** and finish in
the API process (interim until BullMQ — see
[WORKER_AND_STREAMER.md](../../architecture/WORKER_AND_STREAMER.md)). Completion
uses:

| Type                    | When                             |
| ----------------------- | -------------------------------- |
| `entity_archived`       | Soft archive succeeded           |
| `entity_archive_failed` | Soft archive failed after accept |
| `entity_purged`         | Hard purge succeeded             |
| `entity_purge_failed`   | Hard purge failed after accept   |

Messages may include markdown `[Open](/path)` / `[Open list](/path)` links;
`resolveNotificationHref` reads the first in-app link for row navigation.

## Related

- User guide: [Dashboard inbox](../../user-guide/notifications/dashboard-inbox.md)
- Due dates only: `GET /api/notifications/check-due-dates`
- Daily reminders: `GET /api/notifications/daily-reminders`
- Access-request alerts: [ACCESS_REQUESTS.md](../access/ACCESS_REQUESTS.md)
- Busy-retry + 202 exceptions: [DATABASE_BUSY_RETRY.md](../../guides/DATABASE_BUSY_RETRY.md)
