'use client';

import { AccessRequestNotificationDialog } from '@/app/notifications/_components/access-request-notification-dialog';
import { createNotificationsInboxListHandlers } from '@/app/notifications/_components/notifications-inbox-handlers';
import { NotificationsInboxList } from '@/app/notifications/_components/notifications-inbox-list';
import { NotificationsMarkAllAsReadButton } from '@/app/notifications/_components/notifications-mark-all-as-read-button';
import { useNotificationsInbox } from '@/app/notifications/_components/use-notifications-inbox';
import { NOTIFICATIONS_PAGE_LIMIT } from '@/lib/notifications/fetch-dashboard-inbox';
import { inboxSubtitleText } from '@/lib/notifications/notification-inbox-meta';

export function NotificationsPageClient({
  userId,
}: Readonly<{ userId: string }>) {
  const inbox = useNotificationsInbox({
    userId,
    limit: NOTIFICATIONS_PAGE_LIMIT,
    realtimeChannelScope: 'page',
  });
  const listHandlers = createNotificationsInboxListHandlers(inbox);

  return (
    <>
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <div className="border-border bg-muted/20 flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-foreground text-sm font-semibold">Inbox</h2>
            <p className="text-muted-foreground text-xs">
              {inboxSubtitleText({
                loading: inbox.loading,
                loadFailed: inbox.loadFailed,
                unreadCount: inbox.unreadCount,
              })}
            </p>
          </div>
          <NotificationsMarkAllAsReadButton
            unreadCount={inbox.unreadCount}
            onMarkAllAsRead={listHandlers.onMarkAllAsRead}
          />
        </div>
        <div className="divide-border/60 divide-y">
          <NotificationsInboxList
            notifications={inbox.notifications}
            loading={inbox.loading}
            loadFailed={inbox.loadFailed}
            onRetry={listHandlers.onRetry}
            onArchive={listHandlers.onArchive}
            onNotificationClick={listHandlers.onNotificationClick}
            onInternalLinkClick={listHandlers.onInternalLinkClick}
          />
        </div>
      </div>

      <AccessRequestNotificationDialog
        notification={inbox.selectedAccessRequest}
        onClose={inbox.closeAccessRequestDialog}
        onAllow={inbox.allowAccessRequest}
      />
    </>
  );
}
