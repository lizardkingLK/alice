'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { Bell } from '@repo/ui/lib/icons';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { cn } from '@repo/ui/lib/utils';
import { HomeNotificationRelativeTime } from '@/app/_components/home/home-notification-relative-time';
import {
  NotificationMessage,
  stripNotificationMarkdown,
} from '@/lib/notifications/notification-message';
import { resolveNotificationHref } from '@/lib/notifications/resolve-notification-href';
import {
  NOTIFICATION_ICON_COLOR_MAP,
  NOTIFICATION_ICON_MAP,
  UNREAD_BADGE_CAP,
} from '@/lib/notifications/notification-inbox-meta';
import type { HomeLaunchpadNotification } from '@/app/_components/home/home-launchpad.types';

type HomeNotificationsPanelProps = {
  readonly notifications: readonly HomeLaunchpadNotification[];
  readonly variant?: 'card' | 'plain';
  readonly showTitle?: boolean;
  readonly hideWhenEmpty?: boolean;
};

function UnreadCountPill({ count }: Readonly<{ count: number }>) {
  if (count <= 0) {
    return null;
  }

  const label =
    count > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(count);

  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white"
      title={`${count} unread`}
      aria-label={`${count} unread`}
    >
      {label}
    </span>
  );
}

export function HomeNotificationList({
  notifications,
}: Readonly<{ notifications: readonly HomeLaunchpadNotification[] }>) {
  return (
    <ul className="divide-border/60 -mx-1.5 divide-y">
      {notifications.map((notification) => {
        const href = resolveNotificationHref(
          {
            type: notification.type,
            related_item_id: notification.relatedItemId,
            message: notification.message,
          },
          null
        );
        const Icon = (NOTIFICATION_ICON_MAP[notification.type] ||
          NOTIFICATION_ICON_MAP.default ||
          Bell) as ComponentType<{ className?: string }>;
        const iconStyles =
          NOTIFICATION_ICON_COLOR_MAP[notification.type] ||
          NOTIFICATION_ICON_COLOR_MAP.default ||
          '';

        const row = (
          <div className="hover:bg-muted/50 flex items-start gap-3 rounded-md px-1.5 py-2.5 transition-colors">
            <div
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold',
                iconStyles
              )}
            >
              <Icon className="size-4" />
            </div>
            <div
              className="min-w-0 flex-1 space-y-1"
              title={stripNotificationMarkdown(notification.message)}
            >
              <div className="text-foreground line-clamp-3 text-xs leading-relaxed font-medium wrap-break-word">
                <NotificationMessage message={notification.message} />
              </div>
              <HomeNotificationRelativeTime
                value={notification.createdAt}
                className="block font-sans text-[10px] font-normal"
              />
            </div>
            <span
              className="bg-primary mt-1 size-2 shrink-0 animate-pulse self-center rounded-full"
              aria-hidden
            />
          </div>
        );

        return (
          <li key={notification.id}>
            {href ? (
              <Link href={href} className="block">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function HomeNotificationsPanel({
  notifications,
  variant = 'card',
  showTitle = true,
  hideWhenEmpty = true,
}: Readonly<HomeNotificationsPanelProps>) {
  if (hideWhenEmpty && notifications.length === 0) {
    return null;
  }

  const count = notifications.length;
  const titleRow = showTitle ? (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <CardTitle className="text-base">Unread notifications</CardTitle>
      <UnreadCountPill count={count} />
    </div>
  ) : null;

  const list =
    notifications.length > 0 ? (
      <HomeNotificationList notifications={notifications} />
    ) : null;

  if (variant === 'plain') {
    return (
      <section className="space-y-3">
        {showTitle ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Unread notifications</h2>
            <UnreadCountPill count={count} />
          </div>
        ) : null}
        {list}
      </section>
    );
  }

  return (
    <Card size="sm" className={cn('dashboard-widget-glass shadow-none')}>
      {titleRow ? <CardHeader className="pb-2">{titleRow}</CardHeader> : null}
      <CardContent>{list}</CardContent>
    </Card>
  );
}
