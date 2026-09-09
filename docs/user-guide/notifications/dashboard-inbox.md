# Dashboard inbox

Read and clear alerts from the header bell menu.

**Audience:** All users

---

## Open the inbox

1. On any dashboard page, select the **bell** icon in the header (aria-label:
   **View notifications**). The page itself does not wait for this list — the
   inbox loads in the background so slow connections still open Users, Board,
   and other dashboard routes.

A dropdown panel opens with your recent notifications. If the list fails to
load, select **Try again**.

---

## Panel actions

| Control                  | Action                                           |
| ------------------------ | ------------------------------------------------ |
| Notification row         | Mark read and navigate to the related item       |
| **Mark all as read**     | Clear unread state (shown when unread count > 0) |
| **Archive** (X on hover) | Remove item from the list                        |

When empty: **No notifications yet** — mentions and updates will appear here.

The inbox shows up to **50** recent active items. Each alert is for you only
(not a shared feed). Notifications you have already read, or archived, that are
older than **30 days** are removed automatically.

---

## Notification types

Examples you may see:

| Type                           | Usually opens             |
| ------------------------------ | ------------------------- |
| **mention** / **comment**      | Work item discussion      |
| **assign** / **status_change** | Work item detail          |
| **due_date**                   | Work item detail          |
| **sprint**                     | Sprint or work context    |
| **view_shared**                | Saved view                |
| **chat_processed**             | Alice chat conversation   |
| **access_request**             | Users → Requests (admins) |

Unread count shows on the bell badge (caps at **9+**).

---

## Realtime updates

New notifications arrive while you're signed in without refreshing the page.

---

## Related

- [Comments and activity](../work-items/comments-and-activity.md)
- [Access requests](../users-and-access/access-requests.md) (admins)
