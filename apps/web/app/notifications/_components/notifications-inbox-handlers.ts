import type { MouseEvent } from 'react';
import type {
  Notification,
  useNotificationsInbox,
} from '@/app/notifications/_components/use-notifications-inbox';

type NotificationsInbox = ReturnType<typeof useNotificationsInbox>;

/** Shared list action wiring for header dropdown and `/notifications` page. */
export function createNotificationsInboxListHandlers(
  inbox: NotificationsInbox,
  options?: { onBeforeNavigate?: () => void }
) {
  return {
    onRetry: inbox.handleRetry,
    onMarkAllAsRead: () => {
      inbox.handleMarkAllAsRead().catch(() => {});
    },
    onArchive: (notificationId: string, event: MouseEvent) => {
      inbox.handleArchive(notificationId, event).catch(() => {});
    },
    onNotificationClick: (notification: Notification) => {
      inbox
        .handleNotificationClick(notification, {
          onBeforeNavigate: options?.onBeforeNavigate,
        })
        .catch(() => {});
    },
    onInternalLinkClick: (notification: Notification) => {
      options?.onBeforeNavigate?.();
      if (!notification.read_status) {
        inbox.handleMarkAsRead(notification.id).catch(() => {});
      }
    },
  };
}
