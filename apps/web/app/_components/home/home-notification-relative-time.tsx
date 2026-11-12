'use client';

import { useEffect, useState } from 'react';
import { formatDateTime } from '@/app/_shared/utility';
import { formatNotificationRelativeTime } from '@/lib/notifications/notification-inbox-meta';
import { cn } from '@repo/ui/lib/utils';

type HomeNotificationRelativeTimeProps = {
  readonly value: string;
  readonly className?: string;
};

/**
 * Inbox-style relative timestamp (e.g. "2h ago"). Client-only after mount.
 */
export function HomeNotificationRelativeTime({
  value,
  className,
}: Readonly<HomeNotificationRelativeTimeProps>) {
  const [label, setLabel] = useState(() => formatDateTime(value));

  useEffect(() => {
    setLabel(formatNotificationRelativeTime(value));
    const id = window.setInterval(() => {
      setLabel(formatNotificationRelativeTime(value));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [value]);

  return (
    <time
      dateTime={value}
      title={formatDateTime(value)}
      className={cn(
        'text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums',
        className
      )}
    >
      {label}
    </time>
  );
}
