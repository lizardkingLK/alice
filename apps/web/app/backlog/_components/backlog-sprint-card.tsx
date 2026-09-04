'use client';

import type React from 'react';
import { BacklogDropZone } from '@/app/backlog/_components/backlog-drop-zone';
import {
  formatDateRange,
  type BacklogAssignee,
} from '@/app/backlog/_helpers/backlog-item-utils';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { SprintStatusEnum } from '@repo/types';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Card } from '@repo/ui/components/ui/card';
import { Separator } from '@repo/ui/components/ui/separator';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Play,
} from '@repo/ui/lib/icons';
import { sprintReportHref } from '@/app/sprints/_helpers/sprint-report-links';

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

/* eslint-disable no-unused-vars */
type BacklogSprintCardProps = {
  readonly sprint: Sprint;
  readonly items: DbWorkItem[];
  readonly issueCount: number;
  readonly isCollapsed: boolean;
  readonly isDragOver: boolean;
  readonly isManagerOrAdmin: boolean;
  readonly projects: DbProject[];
  readonly projectMembers: readonly BacklogAssignee[];
  readonly onToggle: (sprintId: string) => void;
  readonly onStartSprint: (sprintId: string) => void;
  readonly onCompleteSprint: (sprintId: string) => void;
  readonly onSelectItem: (item: DbWorkItem) => void;
  readonly onItemDragStart: (event: React.DragEvent, id: string) => void;
  readonly onDragOver: (
    event: React.DragEvent,
    targetId: string | null
  ) => void;
  readonly onDragLeave: () => void;
  readonly onDrop: (event: React.DragEvent, targetId: string | null) => void;
};
/* eslint-enable no-unused-vars */

function openSprintSummaryReport(sprintId: string) {
  window.open(
    sprintReportHref(sprintId, 'backlog'),
    '_blank',
    'noopener,noreferrer'
  );
}

type SprintCardActionsProps = {
  readonly sprint: Sprint;
  readonly issueCount: number;
  readonly isManagerOrAdmin: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onStartSprint: (sprintId: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onCompleteSprint: (sprintId: string) => void;
};

function SprintCardActions({
  sprint,
  issueCount,
  isManagerOrAdmin,
  onStartSprint,
  onCompleteSprint,
}: Readonly<SprintCardActionsProps>) {
  if (sprint.status === SprintStatusEnum.Closed) {
    if (!isManagerOrAdmin) {
      return null;
    }

    return (
      <Button
        size="sm"
        variant="outline"
        className="h-8 cursor-pointer"
        onClick={(event) => {
          event.stopPropagation();
          openSprintSummaryReport(sprint.id);
        }}
      >
        Summary Report
      </Button>
    );
  }

  return (
    <>
      <span className="text-muted-foreground bg-muted rounded-full px-2.5 py-0.5 text-xs font-semibold">
        {issueCount} item{issueCount === 1 ? '' : 's'}
      </span>

      <Separator
        orientation="vertical"
        className="hidden h-6 @xl/sprint-card:block"
      />

      {isManagerOrAdmin && sprint.status === SprintStatusEnum.Active ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 cursor-pointer"
          onClick={(event) => {
            event.stopPropagation();
            openSprintSummaryReport(sprint.id);
          }}
        >
          Summary Report
        </Button>
      ) : null}

      {isManagerOrAdmin && sprint.status === SprintStatusEnum.Planned ? (
        <Button
          size="sm"
          className="h-8 cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => onStartSprint(sprint.id)}
        >
          <Play className="mr-1 size-3 fill-current" />
          Start Sprint
        </Button>
      ) : null}

      {isManagerOrAdmin && sprint.status === SprintStatusEnum.Active ? (
        <Button
          size="sm"
          className="h-8 cursor-pointer bg-sky-600 text-white hover:bg-sky-700"
          onClick={() => onCompleteSprint(sprint.id)}
        >
          <Check className="mr-1 size-3.5" />
          Complete Sprint
        </Button>
      ) : null}
    </>
  );
}

export function BacklogSprintCard({
  sprint,
  items,
  issueCount,
  isCollapsed,
  isDragOver,
  isManagerOrAdmin,
  projects,
  projectMembers,
  onToggle,
  onStartSprint,
  onCompleteSprint,
  onSelectItem,
  onItemDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: Readonly<BacklogSprintCardProps>) {
  const statusBadge = SPRINT_STATUS_BADGE[sprint.status];

  return (
    <Card
      className={cn(
        'border-border/70 @container/sprint-card overflow-hidden shadow-sm transition-all duration-200',
        sprint.status === SprintStatusEnum.Active
          ? 'border-l-primary border-l-4'
          : 'border-l-muted-foreground/30 border-l-4'
      )}
    >
      <div className="bg-muted/30 hover:bg-muted/50 border-border/50 flex flex-col justify-between gap-3 border-b px-4 py-3 transition-colors @xl/sprint-card:flex-row @xl/sprint-card:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            onClick={() => onToggle(sprint.id)}
          >
            {isCollapsed ? (
              <ChevronRight className="text-muted-foreground size-4" />
            ) : (
              <ChevronDown className="text-muted-foreground size-4" />
            )}
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <TruncatedText className="text-foreground font-semibold">
                {sprint.name}
              </TruncatedText>
              {statusBadge ? (
                <Badge variant="outline" className={statusBadge.className}>
                  {statusBadge.label}
                </Badge>
              ) : null}
            </div>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5 shrink-0" />
                {formatDateRange(sprint.startDate, sprint.endDate)}
              </span>
              {sprint.project ? (
                <>
                  <span className="text-muted-foreground/60">{'•'}</span>
                  <TruncatedText className="text-primary max-w-40 font-semibold">
                    {sprint.project.name}
                  </TruncatedText>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 @xl/sprint-card:shrink-0 @xl/sprint-card:gap-3">
          <SprintCardActions
            sprint={sprint}
            issueCount={issueCount}
            isManagerOrAdmin={isManagerOrAdmin}
            onStartSprint={onStartSprint}
            onCompleteSprint={onCompleteSprint}
          />
        </div>
      </div>

      {!isCollapsed ? (
        <BacklogDropZone
          items={items}
          projects={projects}
          projectMembers={projectMembers}
          targetId={sprint.id}
          isDragOver={isDragOver}
          minHeightClass="min-h-22.5"
          emptyMessage="Plan this sprint by dragging backlog items here"
          onSelectItem={onSelectItem}
          onItemDragStart={onItemDragStart}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
      ) : null}
    </Card>
  );
}
