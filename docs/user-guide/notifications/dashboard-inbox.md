# Dashboard inbox

Read and clear alerts from the header bell or the Notifications page.

**Audience:** All users

---

## Open the inbox

1. On any dashboard page, select the **bell** icon in the header (aria-label:
   **View notifications**). The page itself does not wait for this list — the
   inbox loads in the background so slow connections still open Users, Board,
   and other dashboard routes.
2. Or open **Notifications** in the sidebar, which goes to `/notifications`.
3. From the bell dropdown, use the expand control to open the same full inbox
   page.

A dropdown panel opens with your recent notifications. If the list fails to
load, select **Try again**.

---

## Panel actions

| Control                            | Action                                           |
| ---------------------------------- | ------------------------------------------------ |
| Notification row                   | Mark read and navigate to the related item       |
| **Mark all as read**               | Clear unread state (shown when unread count > 0) |
| **Archive** (X on hover)           | Remove item from the list                        |
| Expand / **Notifications** sidebar | Open the full `/notifications` inbox             |

When empty: **No notifications yet** — mentions and updates will appear here.

The header dropdown shows up to **50** recent active items. The Notifications
page shows up to **100**. Each alert is for you only (not a shared feed).
Notifications you have already read, or archived, that are older than **30
days** are removed automatically.

---

## Notification types

Examples you may see:

| Type                           | Usually opens                                          |
| ------------------------------ | ------------------------------------------------------ |
| **mention** / **comment**      | Work item discussion                                   |
| **assign** / **status_change** | Work item detail                                       |
| **due_date**                   | Work item detail                                       |
| **worklog_pending**            | My Work (pace gap vs today’s ideal burndown)           |
| **sprint**                     | Sprint or work context                                 |
| **view_shared**                | Saved view                                             |
| **chart_shared**               | Charts workspace                                       |
| **chat_processed**             | Alice chat conversation                                |
| **access_request**             | Users → Requests (admins)                              |
| **project_created**            | New project details (e.g. “Project **Acme** is ready”) |
| **project_create_failed**      | Message only (no link)                                 |
| **entity_archived**            | Link in the message (archived item or list)            |
| **entity_archive_failed**      | Message only (retry from the registry if needed)       |
| **entity_purged**              | List link in the message (item is gone)                |
| **entity_purge_failed**        | Message only                                           |

**Worklog pace alerts** appear when your logged hours on active sprint work are
behind the ideal amount for the end of today. The message tells you roughly how
many hours to log to catch up.

Project-ready alerts bold the project name and link it to the project page.
Archive and permanent-delete jobs are **async**: you get a toast when the
request is accepted, then an inbox alert when the job finishes (or fails).
Other types usually open from the whole row using the related item.

Unread count shows on the bell badge. Counts of **1–9** show the number; **10
or more** show a star.

---

## Realtime updates

New notifications arrive while you're signed in without refreshing the page.

---

## Related

- [Comments and activity](../work-items/comments-and-activity.md)
- [Access requests](../users-and-access/access-requests.md) (admins)
