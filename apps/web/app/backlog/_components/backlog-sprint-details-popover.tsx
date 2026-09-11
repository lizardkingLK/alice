'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDate } from '@/app/_shared/utility';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { SprintStatusEnum } from '@repo/types';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/ui/popover';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { Calendar, FolderKanban, Info } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

const HOVER_OPEN_MS = 280;
const HOVER_CLOSE_MS = 180;

const SPRINT_STATUS_BADGE: Partial<
  Record<Sprint['status'], { label: string; className: string }>
> = {
  [SprintStatusEnum.Active]: {
    label: 'Active',
    className:
      'border-primary/20 bg-primary/10 px-2 py-0 font-semibold text-primary',
  },
  [SprintStatusEnum.Closed]: {
    label: 'Closed',
    className:
      'border-emerald-500/20 bg-emerald-500/10 px-2 py-0 font-semibold text-emerald-600 dark:text-emerald-400',
  },
  [SprintStatusEnum.Planned]: {
    label: 'Planned',
    className:
      'border-muted-foreground/20 bg-muted px-2 py-0 font-semibold text-muted-foreground',
  },
  [SprintStatusEnum.Archived]: {
    label: 'Archived',
    className:
      'border-amber-500/20 bg-amber-500/10 px-2 py-0 font-semibold text-amber-500 dark:text-amber-400',
  },
};

type BacklogSprintDetailsPopoverProps = {
  readonly sprint: Sprint;
};

function formatSprintDate(value: string | Date | null): string {
  if (!value) {
    return 'Not set';
  }
  const iso = value instanceof Date ? value.toISOString() : value;
  return formatDate(iso) || 'Not set';
}

export function BacklogSprintDetailsPopover({
  sprint,
}: Readonly<BacklogSprintDetailsPopoverProps>) {
  const [open, setOpen] = useState(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const statusBadge = SPRINT_STATUS_BADGE[sprint.status];

  const clearTimers = () => {
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => () => clearTimers(), []);

  const scheduleOpen = () => {
    clearTimers();
    openTimerRef.current = window.setTimeout(
      () => setOpen(true),
      HOVER_OPEN_MS
    );
  };

  const scheduleClose = () => {
    clearTimers();
    closeTimerRef.current = window.setTimeout(
      () => setOpen(false),
      HOVER_CLOSE_MS
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex min-w-0 items-center gap-1">
        <PopoverTrigger asChild>
          <button
            type="button"
            title={sprint.name}
            className="text-foreground hover:text-primary max-w-full min-w-0 cursor-pointer truncate text-left text-sm font-semibold transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              clearTimers();
            }}
          >
            {sprint.name}
          </button>
        </PopoverTrigger>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
          aria-label={`Sprint details for ${sprint.name}`}
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
          onFocus={scheduleOpen}
          onBlur={scheduleClose}
          onClick={(event) => {
            event.stopPropagation();
            clearTimers();
            setOpen(true);
          }}
        >
          <Info className="size-3.5" />
        </Button>
      </div>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        className="w-72 gap-3 p-3"
        onMouseEnter={clearTimers}
        onMouseLeave={scheduleClose}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-foreground text-sm leading-snug font-semibold">
              {sprint.name}
            </p>
            {statusBadge ? (
              <Badge
                variant="outline"
                className={cn('shrink-0', statusBadge.className)}
              >
                {statusBadge.label}
              </Badge>
            ) : null}
          </div>

          <div className="text-muted-foreground flex flex-col gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5 shrink-0" />
              <span>
                {formatSprintDate(sprint.startDate)}
                {' – '}
                {formatSprintDate(sprint.endDate)}
              </span>
            </span>
            {sprint.project ? (
              <span className="text-foreground/90 inline-flex min-w-0 items-center gap-1.5 font-medium">
                <FolderKanban className="text-primary size-3.5 shrink-0" />
                <TruncatedText className="min-w-0">
                  {sprint.project.name}
                </TruncatedText>
              </span>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
