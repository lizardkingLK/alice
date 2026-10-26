'use client';

import { useEffect, useState } from 'react';
import { getTimeOfDayGreeting } from '@/app/_components/home/get-time-of-day-greeting';
import { cn } from '@repo/ui/lib/utils';

type HomeTimeGreetingProps = {
  readonly displayName: string;
  readonly className?: string;
};

/**
 * Client-only time-of-day prefix so the greeting matches the user's locale
 * clock (avoids SSR/timezone mismatch).
 */
export function HomeTimeGreeting({
  displayName,
  className,
}: Readonly<HomeTimeGreetingProps>) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(getTimeOfDayGreeting());
  }, []);

  const prefix = greeting === null ? 'Hello' : greeting;

  return (
    <h1 className={className}>
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
    </h1>
  );
}
