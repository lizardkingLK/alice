'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';

type RegistryTitleCellProps = {
  readonly href: string;
  readonly title: string;
  readonly subtitle: ReactNode;
  readonly className?: string;
  /** Optional control before the link (e.g. hierarchy expand). */
  readonly leading?: ReactNode;
};

/**
 * Shared registry table title cell: initial avatar chip + title + meta line.
 */
export function RegistryTitleCell({
  href,
  title,
  subtitle,
  className,
  leading,
}: Readonly<RegistryTitleCellProps>) {
  const initial = title.slice(0, 1).toUpperCase() || '?';

  return (
    <div className={cn('flex min-w-48 items-center gap-2', className)}>
      {leading}
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={cn(
            'bg-primary/10 text-primary border-primary/20',
            'flex size-8 shrink-0 items-center justify-center',
            'rounded-lg border text-xs font-bold'
          )}
        >
          {initial}
        </div>
        <div className="min-w-0 space-y-1 font-medium">
          <TruncatedText className="block font-medium">{title}</TruncatedText>
          <div className="text-muted-foreground truncate text-xs">
            {subtitle}
          </div>
        </div>
      </Link>
    </div>
  );
}
