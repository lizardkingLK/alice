'use client';

import { useEffect, useState } from 'react';
import { getTimeOfDayGreeting } from '@/app/_components/home/get-time-of-day-greeting';
import { cn } from '@repo/ui/lib/utils';

type HomeTimeGreetingProps = {
  readonly displayName?: string;
  readonly className?: string;
  readonly as?: 'h1' | 'h2';
  /** When false, render only the time-of-day phrase (no name). */
  readonly showName?: boolean;
};

/**
 * Client-only time-of-day prefix so the greeting matches the user's locale
 * clock (avoids SSR/timezone mismatch).
 */
export function HomeTimeGreeting({
  displayName,
  className,
  as: Tag = 'h1',
  showName = true,
}: Readonly<HomeTimeGreetingProps>) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(getTimeOfDayGreeting());
  }, []);

  const prefix = greeting ?? 'Hello';
  const withName = showName && Boolean(displayName?.trim());

  return (
    <Tag className={className}>
      {withName ? (
        <>
          {prefix}
          {', '}
          <span
            className={cn(
              'font-semibold',
              'text-[color-mix(in_oklch,var(--primary)_72%,white)]'
            )}
          >
            {displayName}
          </span>
        </>
      ) : (
        <>{prefix}</>
      )}
    </Tag>
  );
}
