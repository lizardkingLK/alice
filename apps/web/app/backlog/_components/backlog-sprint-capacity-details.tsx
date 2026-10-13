'use client';

import {
  formatCapacityPoints,
  isCapacityNearFull,
  isCapacityOver,
  type SprintCapacitySnapshot,
} from '@/app/backlog/_helpers/backlog-sprint-capacity';
import { Progress } from '@repo/ui/components/ui/progress';
import { cn } from '@repo/ui/lib/utils';

type BacklogSprintCapacityDetailsProps = {
  readonly snapshot: SprintCapacitySnapshot;
};

/** Capacity block shared inside the sprint details popover. */
export function BacklogSprintCapacityDetails({
  snapshot,
}: Readonly<BacklogSprintCapacityDetailsProps>) {
  const isOver = isCapacityOver(snapshot);
  const nearFull = isCapacityNearFull(snapshot);

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Sprint capacity</p>
        <p className="text-muted-foreground text-xs">
          Story points planned vs team capacity
        </p>
      </div>

      {snapshot.hasConfiguredCapacity ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Allocated</span>
            <span
              className={cn(
                'font-semibold tabular-nums',
                isOver ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
              )}
            >
              {formatCapacityPoints(snapshot.usedPoints)}
              {' / '}
              {formatCapacityPoints(snapshot.totalCapacity)} pts
            </span>
          </div>
          <Progress
            value={snapshot.percentUsed}
            className="h-2"
            indicatorClassName={cn(
              isOver && 'bg-rose-500',
              nearFull && 'bg-amber-500'
            )}
          />
          <p className="text-muted-foreground text-[11px] leading-snug">
            {isOver
              ? 'Over capacity — moving more points into this sprint may be blocked.'
              : `${snapshot.percentUsed}% of configured team capacity used.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs leading-relaxed">
            No team capacity configured for this project yet. Sprint capacity
            limits are not enforced until members have capacity or allocation
            set.
          </p>
          <p className="text-foreground text-xs font-medium tabular-nums">
            {formatCapacityPoints(snapshot.usedPoints)} pts planned in this
            sprint
          </p>
        </div>
      )}
    </div>
  );
}
