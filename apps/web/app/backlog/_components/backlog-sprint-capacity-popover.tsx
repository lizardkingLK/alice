'use client';

import { useMemo } from 'react';
import {
  computeSprintCapacity,
  type ProjectTeamMemberCapacity,
} from '@/app/backlog/_helpers/backlog-sprint-capacity';
import {
  BACKLOG_HOVER_CLOSE_MS,
  BACKLOG_HOVER_OPEN_MS,
} from '@/app/backlog/_helpers/backlog-hover-delays';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { Button } from '@repo/ui/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@repo/ui/components/ui/hover-card';
import { Progress } from '@repo/ui/components/ui/progress';
import { Gauge } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type BacklogSprintCapacityPopoverProps = {
  readonly sprintName: string;
  readonly projectId: string | null | undefined;
  readonly items: readonly DbWorkItem[];
  readonly teamMembers: readonly ProjectTeamMemberCapacity[];
};

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function BacklogSprintCapacityPopover({
  sprintName,
  projectId,
  items,
  teamMembers,
}: Readonly<BacklogSprintCapacityPopoverProps>) {
  const snapshot = useMemo(
    () =>
      computeSprintCapacity({
        projectId,
        storyPoints: items.map((item) => item.story_points),
        teamMembers,
      }),
    [items, projectId, teamMembers]
  );

  const isOver =
    snapshot.hasConfiguredCapacity &&
    snapshot.usedPoints > snapshot.totalCapacity;

  return (
    <HoverCard
      openDelay={BACKLOG_HOVER_OPEN_MS}
      closeDelay={BACKLOG_HOVER_CLOSE_MS}
    >
      <HoverCardTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
          aria-label={`Sprint capacity for ${sprintName}`}
          onClick={(event) => event.stopPropagation()}
        >
          <Gauge className="size-3.5" />
        </Button>
      </HoverCardTrigger>

      <HoverCardContent
        align="start"
        side="bottom"
        sideOffset={8}
        className="w-72 gap-3 p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Sprint capacity</p>
          <p className="text-muted-foreground text-xs">
            Story points planned vs team capacity
          </p>
        </div>

        {snapshot.hasConfiguredCapacity ? (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Allocated</span>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  isOver
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-foreground'
                )}
              >
                {formatPoints(snapshot.usedPoints)}
                {' / '}
                {formatPoints(snapshot.totalCapacity)} pts
              </span>
            </div>
            <Progress
              value={snapshot.percentUsed}
              className="h-2"
              indicatorClassName={cn(
                isOver && 'bg-rose-500',
                !isOver && snapshot.percentUsed >= 90 && 'bg-amber-500'
              )}
            />
            <p className="text-muted-foreground text-[11px] leading-snug">
              {isOver
                ? 'Over capacity — moving more points into this sprint may be blocked.'
                : `${snapshot.percentUsed}% of configured team capacity used.`}
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-muted-foreground text-xs leading-relaxed">
              No team capacity configured for this project yet. Sprint capacity
              limits are not enforced until members have capacity or allocation
              set.
            </p>
            <p className="text-foreground text-xs font-medium tabular-nums">
              {formatPoints(snapshot.usedPoints)} pts planned in this sprint
            </p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
