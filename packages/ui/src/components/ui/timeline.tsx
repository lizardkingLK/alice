'use client';

import * as React from 'react';

import { cn } from '@repo/ui/lib/utils';

/**
 * Vertical timeline primitives (shadcn-style compound API).
 * CSS-only — no animation library required.
 */
function Timeline({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="timeline"
      className={cn('relative flex flex-col', className)}
      {...props}
    />
  );
}

function TimelineItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="timeline-item"
      className={cn('group/timeline-item relative flex gap-3', className)}
      {...props}
    />
  );
}

function TimelineSeparator({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="timeline-separator"
      className={cn('flex w-8 shrink-0 flex-col items-center', className)}
      {...props}
    />
  );
}

function TimelineIndicator({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="timeline-indicator"
      className={cn(
        'bg-background border-border relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border',
        className
      )}
      {...props}
    >
      {children ?? (
        <span className="bg-primary size-2.5 rounded-full" aria-hidden />
      )}
    </div>
  );
}

function TimelineConnector({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="timeline-connector"
      aria-hidden
      className={cn(
        'bg-border w-px grow group-last/timeline-item:hidden',
        className
      )}
      {...props}
    />
  );
}

function TimelineContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="timeline-content"
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-1 pb-6 group-last/timeline-item:pb-0',
        className
      )}
      {...props}
    />
  );
}

function TimelineTitle({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="timeline-title"
      className={cn(
        'text-foreground text-sm leading-snug font-medium',
        className
      )}
      {...props}
    />
  );
}

function TimelineDescription({
  className,
  ...props
}: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="timeline-description"
      className={cn('text-muted-foreground text-sm leading-snug', className)}
      {...props}
    />
  );
}

function TimelineTime({ className, ...props }: React.ComponentProps<'time'>) {
  return (
    <time
      data-slot="timeline-time"
      className={cn('text-muted-foreground text-xs', className)}
      {...props}
    />
  );
}

export {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineIndicator,
  TimelineConnector,
  TimelineContent,
  TimelineTitle,
  TimelineDescription,
  TimelineTime,
};
