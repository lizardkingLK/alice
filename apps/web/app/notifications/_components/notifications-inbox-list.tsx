'use client';

import { AlertCircle, Bell, InboxIcon, X } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { Button } from '@repo/ui/components/ui/button';
import {
  NotificationMessage,
  stripNotificationMarkdown,
} from '@/lib/notifications/notification-message';
import {
  formatNotificationRelativeTime,
  NOTIFICATION_ICON_COLOR_MAP,
  NOTIFICATION_ICON_MAP,
} from '@/lib/notifications/notification-inbox-meta';
import type { Notification } from '@/app/notifications/_components/use-notifications-inbox';

function NotificationsEmptyState({
  icon,
  title,
  description,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  description: string;
}>) {
  return (
    <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <div className="bg-muted/40 border-border/50 rounded-full border p-3">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-foreground text-sm font-medium">{title}</p>
        <p className="max-w-xs text-xs">{description}</p>
      </div>
    </div>
  );
}

type NotificationsInboxListProps = {
  notifications: Notification[];
  loading: boolean;
  loadFailed: boolean;
  dense?: boolean;
  onRetry: () => void;
  // eslint-disable-next-line no-unused-vars -- archive callback
  onArchive: (notificationId: string, event: React.MouseEvent) => void;
  // eslint-disable-next-line no-unused-vars -- row click callback
  onNotificationClick: (notification: Notification) => void;
  // eslint-disable-next-line no-unused-vars -- markdown link callback
  onInternalLinkClick?: (notification: Notification) => void;
};

export function NotificationsInboxList({
  notifications,
  loading,
  loadFailed,
  dense = false,
  onRetry,
  onArchive,
  onNotificationClick,
  onInternalLinkClick,
}: Readonly<NotificationsInboxListProps>) {
  if (loading) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-sm">
        <div className="border-primary size-4 animate-spin rounded-full border-2 border-t-transparent" />
        <span>Loading notifications...</span>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="flex flex-col items-center">
        <NotificationsEmptyState
          icon={<AlertCircle className="text-destructive/80 size-6" />}
          title="Couldn't load notifications"
          description="Check your connection and try again. New alerts may still arrive in realtime."
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mb-4"
          onClick={onRetry}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <NotificationsEmptyState
        icon={<InboxIcon className="text-muted-foreground/60 size-6" />}
        title="No notifications yet"
        description="We'll let you know when you get mentioned or updates occur."
      />
    );
  }

  return (
    <>
      {notifications.map((notif) => {
        const Icon = (NOTIFICATION_ICON_MAP[notif.type] ||
          NOTIFICATION_ICON_MAP.default ||
          Bell) as React.ComponentType<{ className?: string }>;
        const iconStyles = notif.read_status
          ? cn('text-muted-foreground', 'bg-muted', 'border-border')
          : NOTIFICATION_ICON_COLOR_MAP[notif.type] ||
            NOTIFICATION_ICON_COLOR_MAP.default ||
            '';

        return (
          <div
            key={notif.id}
            className={cn(
              'group hover:bg-accent/40 focus-within:bg-accent/40 relative flex items-start gap-3 transition-colors',
              dense ? 'p-3.5' : 'px-4 py-4',
              !notif.read_status && 'bg-primary/2 dark:bg-primary/1'
            )}
          >
            <button
              type="button"
              onClick={() => onNotificationClick(notif)}
              className="flex flex-1 cursor-pointer items-start gap-3 border-0 bg-transparent p-0 text-left focus-visible:outline-hidden"
            >
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold',
                  iconStyles
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-1 pr-2">
                <div
                  title={stripNotificationMarkdown(notif.message)}
                  className={cn(
                    'text-xs leading-relaxed wrap-break-word',
                    dense ? 'line-clamp-3' : 'line-clamp-5',
                    notif.read_status
                      ? 'text-muted-foreground'
                      : 'text-foreground font-medium'
                  )}
                >
                  <NotificationMessage
                    message={notif.message}
                    onInternalLinkClick={() => {
                      onInternalLinkClick?.(notif);
                    }}
                  />
                </div>
                <span className="text-muted-foreground block text-[10px]">
                  {formatNotificationRelativeTime(notif.created_at)}
                </span>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-1.5 self-center">
              {!notif.read_status && (
                <span className="bg-primary size-2 animate-pulse rounded-full" />
              )}
              <button
                type="button"
                onClick={(e) => onArchive(notif.id, e)}
                aria-label="Archive notification"
                className="hover:bg-accent text-muted-foreground/60 hover:text-foreground flex size-6 cursor-pointer items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-hidden"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
