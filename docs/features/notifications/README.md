# Notifications

Per-user in-app inbox in the dashboard header bell.

| Field        | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| Status       | **Living**                                                    |
| Last updated | 2026-09-10                                                    |
| Scope        | Header inbox, `notifications` table, due-date and prune crons |

## Behavior

- Each row belongs to one `user_id`. There is no “read by all users” flag.
- The dashboard header does **not** block page render on the inbox query.
  `NotificationInbox` loads the latest 50 active rows on the client after mount
  and can retry if the request fails (slow networks, timeouts).
- Realtime inserts/updates/deletes still arrive over Supabase while signed in.
- Bell badge: numeric unread count through 9; a star when unread is 10 or more.

## Retention

Daily cron `GET /api/notifications/prune-read` (Vercel, `30 4 * * *`) deletes
rows that are **older than 30 days** and either:

- `read_status = true`, or
- `status = archived`

Unread active rows are kept. Requires `Authorization: Bearer <CRON_SECRET>`
when that env var is set (same as due-date cron).

## Schema

Inbox list filter: `user_id` + `status = active`, newest `created_at`, limit 50.
Index: `notifications_user_id_status_created_at_idx`.

## Related

- User guide: [Dashboard inbox](../../user-guide/notifications/dashboard-inbox.md)
- Due dates: `GET /api/notifications/check-due-dates`
- Access-request alerts: [ACCESS_REQUESTS.md](../access/ACCESS_REQUESTS.md)
