'use client';

import type { LucideIcon } from '@repo/ui/lib/icons';
import { Inbox } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type ChartsEmptyStateProps = {
  readonly message: string;
  readonly icon?: LucideIcon;
  readonly className?: string;
};

/**
 * Centered empty placeholder for chart pie / drilldown table panes.
 */
export function ChartsEmptyState({
  message,
  icon: Icon = Inbox,
  className,
}: Readonly<ChartsEmptyStateProps>) {
  return (
    <output
      className={cn(
        'text-muted-foreground flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center',
        className
      )}
    >
      <div
        className="bg-muted/40 border-border/50 flex size-14 items-center justify-center rounded-2xl border"
        aria-hidden
      >
        <Icon className="text-muted-foreground size-7 stroke-[1.5]" />
      </div>
      <p className="text-foreground max-w-xs text-sm leading-snug font-medium">
        {message}
      </p>
    </output>
  );
}
