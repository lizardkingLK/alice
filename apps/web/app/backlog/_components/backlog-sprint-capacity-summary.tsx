'use client';

import type { BacklogCapacityDisplayId } from '@/app/backlog/_helpers/backlog-capacity-display-storage';
import {
  formatCapacityHeaderLabel,
  formatCapacityPercentLabel,
  isCapacityNearFull,
  isCapacityOver,
  type SprintCapacitySnapshot,
} from '@/app/backlog/_helpers/backlog-sprint-capacity';
import { Progress } from '@repo/ui/components/ui/progress';
import { cn } from '@repo/ui/lib/utils';

type BacklogSprintCapacitySummaryProps = {
  readonly snapshot: SprintCapacitySnapshot;
  readonly mode: BacklogCapacityDisplayId;
};

export function BacklogSprintCapacitySummary({
  snapshot,
  mode,
}: Readonly<BacklogSprintCapacitySummaryProps>) {
  const over = isCapacityOver(snapshot);
  const nearFull = isCapacityNearFull(snapshot);
  const numbersLabel = formatCapacityHeaderLabel(snapshot);
  const percentLabel = formatCapacityPercentLabel(snapshot);
  const label = mode === 'percentage' ? percentLabel : numbersLabel;
  const showBar = mode === 'bar' && snapshot.hasConfiguredCapacity;

  return (
    <div
      className="flex max-w-36 min-w-0 shrink items-center gap-2"
      title={
        mode === 'percentage'
          ? `${percentLabel} (${numbersLabel})`
          : numbersLabel
      }
    >
      {showBar ? (
        <Progress
          value={snapshot.percentUsed}
          className="h-1.5 min-w-12 flex-1"
          indicatorClassName={cn(
            over && 'bg-rose-500',
            nearFull && 'bg-amber-500'
          )}
          aria-label={`Sprint capacity ${numbersLabel}`}
        />
      ) : null}
      <span
        className={cn(
          'shrink-0 text-xs font-semibold tabular-nums',
          over ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </div>
  );
}
