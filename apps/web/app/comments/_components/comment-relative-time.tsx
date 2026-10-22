'use client';

import { useEffect, useState } from 'react';
import { formatDateTime, formatRelativeTime } from '@/app/_shared/utility';
import { cn } from '@repo/ui/lib/utils';

type CommentRelativeTimeProps = {
  value: string;
  className?: string;
};

/**
 * Chat-style footer timestamp: humanized relative text; full date/time on hover.
 * Relative formatting is client-only (avoids hydration mismatch).
 */
export function CommentRelativeTime({
  value,
  className,
}: Readonly<CommentRelativeTimeProps>) {
  const [relative, setRelative] = useState(() => formatDateTime(value));

  useEffect(() => {
    setRelative(formatRelativeTime(value));
    const id = window.setInterval(() => {
      setRelative(formatRelativeTime(value));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [value]);

  return (
    <time
      dateTime={value}
      title={formatDateTime(value)}
      className={cn(
        'text-muted-foreground text-[11px] tabular-nums',
        className
      )}
    >
      {relative}
    </time>
  );
}
