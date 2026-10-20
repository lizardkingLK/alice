'use client';

import {
  computeTimeTrackingSummary,
  formatDuration,
  progressPercent,
} from '@/app/work-items/_helpers/work-item-time-tracking';
import type { WorkItemWorkLog } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/components/ui/collapsible';
import { cn } from '@repo/ui/lib/utils';
import { ChevronDown, Plus } from '@repo/ui/lib/icons';
import { useMemo, useState } from 'react';

type TimeTrackingBarProps = {
  label: string;
  valueLabel: string;
  percent: number;
  fillClassName: string;
};

function TimeTrackingBar({
  label,
  valueLabel,
  percent,
  fillClassName,
}: Readonly<TimeTrackingBarProps>) {
  return (
    <div className="space-y-2 py-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground font-mono text-xs font-normal tabular-nums">
          {valueLabel}
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={cn('h-full rounded-full transition-all', fillClassName)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function formatAgainstEstimate(
  valueHours: number,
  estimatedHours: number,
  hasEstimate: boolean
): string {
  const valueLabel = formatDuration(valueHours);
  if (!hasEstimate) {
    return valueLabel;
  }
  return `${valueLabel} / ${formatDuration(estimatedHours)}`;
}

type WorkItemTimeTrackingProps = {
  storyPoints: number | null | undefined;
  workLogs: WorkItemWorkLog[];
  onLogWorkClick?: () => void;
  /** Solid fill for Remaining — typically workflow state indicator color. */
  remainingFillClassName?: string;
};

export function WorkItemTimeTracking({
  storyPoints,
  workLogs,
  onLogWorkClick,
  remainingFillClassName = 'bg-muted-foreground',
}: Readonly<WorkItemTimeTrackingProps>) {
  const [open, setOpen] = useState(true);

  const summary = useMemo(
    () => computeTimeTrackingSummary(storyPoints, workLogs),
    [storyPoints, workLogs]
  );

  const scale = summary.hasEstimate
    ? summary.estimatedHours
    : Math.max(summary.loggedHours, 1);

  const remainingPercent = progressPercent(summary.remainingHours, scale);
  const loggedPercent = progressPercent(summary.loggedHours, scale);

  const remainingLabel = summary.hasEstimate
    ? formatAgainstEstimate(
        summary.remainingHours,
        summary.estimatedHours,
        true
      )
    : '—';
  const loggedLabel = formatAgainstEstimate(
    summary.loggedHours,
    summary.estimatedHours,
    summary.hasEstimate
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="hover:bg-muted/50 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md py-1 text-left transition-colors"
          >
            <ChevronDown
              className={cn(
                'text-muted-foreground size-4 shrink-0 transition-transform',
                open && 'rotate-180'
              )}
            />
            <span className="text-primary text-sm font-semibold">
              Time Tracking
            </span>
          </button>
        </CollapsibleTrigger>

        {onLogWorkClick ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Log work"
            title="Log work"
            onClick={onLogWorkClick}
          >
            <Plus />
          </Button>
        ) : null}
      </div>

      <CollapsibleContent className="space-y-1 pt-2">
        <TimeTrackingBar
          label="Remaining"
          valueLabel={remainingLabel}
          percent={remainingPercent}
          fillClassName={remainingFillClassName}
        />
        <TimeTrackingBar
          label="Logged"
          valueLabel={loggedLabel}
          percent={loggedPercent}
          fillClassName="bg-primary"
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
