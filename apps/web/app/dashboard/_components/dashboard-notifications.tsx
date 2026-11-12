'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Expand, Star } from '@repo/ui/lib/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { cn } from '@repo/ui/lib/utils';
import { Button } from '@repo/ui/components/ui/button';
import { AccessRequestNotificationDialog } from '@/app/notifications/_components/access-request-notification-dialog';
import { createNotificationsInboxListHandlers } from '@/app/notifications/_components/notifications-inbox-handlers';
import { NotificationsInboxList } from '@/app/notifications/_components/notifications-inbox-list';
import { NotificationsMarkAllAsReadButton } from '@/app/notifications/_components/notifications-mark-all-as-read-button';
import {
  useNotificationsInbox,
  type Notification,
} from '@/app/notifications/_components/use-notifications-inbox';
import {
  inboxSubtitleText,
  notificationsTriggerLabel,
  UNREAD_BADGE_CAP,
} from '@/lib/notifications/notification-inbox-meta';

export type { Notification };

function UnreadCountBadge({ count }: Readonly<{ count: number }>) {
  if (count <= 0) {
    return null;
  }

  const overflow = count > UNREAD_BADGE_CAP;

  return (
    <span
      aria-hidden
      className="ring-background animate-fade-in absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2"
    >
      {overflow ? <Star className="size-2.5 fill-current" /> : count}
    </span>
  );
}

export function NotificationInbox({
  userId,
  initialNotifications,
  initialLoadFailed = false,
}: Readonly<{
  userId: string;
  initialNotifications?: Notification[];
  /** True when a caller already failed to load the inbox (tests / optional SSR). */
  initialLoadFailed?: boolean;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const inbox = useNotificationsInbox({
    userId,
    initialNotifications,
    initialLoadFailed,
    realtimeChannelScope: 'header',
  });
  const listHandlers = createNotificationsInboxListHandlers(inbox, {
    onBeforeNavigate: () => setIsOpen(false),
  });

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={notificationsTriggerLabel(inbox.unreadCount)}
            className="relative cursor-pointer"
          >
            <Bell
              className={cn(
                'size-4 transition-transform duration-300',
                inbox.unreadCount > 0 && 'animate-wiggle'
              )}
            />
            <UnreadCountBadge count={inbox.unreadCount} />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="bg-background/95 border-border w-95 overflow-hidden rounded-xl border p-0 shadow-2xl backdrop-blur-md"
        >
          <div className="border-border bg-muted/20 flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="min-w-0">
              <h3 className="text-foreground text-sm font-semibold">
                Notifications
              </h3>
              <p className="text-muted-foreground text-xs">
                {inboxSubtitleText({
                  loading: inbox.loading,
                  loadFailed: inbox.loadFailed,
                  unreadCount: inbox.unreadCount,
                })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <NotificationsMarkAllAsReadButton
                unreadCount={inbox.unreadCount}
                onMarkAllAsRead={listHandlers.onMarkAllAsRead}
                stopPropagation
              />
              <Button asChild variant="ghost" size="icon" className="size-7">
                <Link
                  href="/notifications"
                  aria-label="Open notifications inbox"
                  title="Open inbox"
                  onClick={() => setIsOpen(false)}
                >
                  <Expand className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="divide-border/60 max-h-90 divide-y overflow-y-auto">
            <NotificationsInboxList
              dense
              notifications={inbox.notifications}
              loading={inbox.loading}
              loadFailed={inbox.loadFailed}
              onRetry={listHandlers.onRetry}
              onArchive={listHandlers.onArchive}
              onNotificationClick={listHandlers.onNotificationClick}
              onInternalLinkClick={listHandlers.onInternalLinkClick}
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccessRequestNotificationDialog
        notification={inbox.selectedAccessRequest}
        onClose={inbox.closeAccessRequestDialog}
        onAllow={inbox.allowAccessRequest}
      />
    </>
  );
}
