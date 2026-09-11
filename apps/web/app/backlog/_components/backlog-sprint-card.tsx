'use client';

import type React from 'react';
import { BacklogDropZone } from '@/app/backlog/_components/backlog-drop-zone';
import { BacklogItemCount } from '@/app/backlog/_components/backlog-item-count';
import { BacklogSprintDetailsPopover } from '@/app/backlog/_components/backlog-sprint-details-popover';
import type { BacklogAssignee } from '@/app/backlog/_helpers/backlog-item-utils';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { SprintStatusEnum } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { Card } from '@repo/ui/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Play,
  Plus,
} from '@repo/ui/lib/icons';
import { sprintReportHref } from '@/app/sprints/_helpers/sprint-report-links';

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
  readonly onCreateIssue: (sprintId: string) => void;
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
  readonly onCreateIssue: (sprintId: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onStartSprint: (sprintId: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onCompleteSprint: (sprintId: string) => void;
};

function SprintCardActions({
  sprint,
  issueCount,
  isManagerOrAdmin,
  onCreateIssue,
  onStartSprint,
  onCompleteSprint,
}: Readonly<SprintCardActionsProps>) {
  const showSummary =
    isManagerOrAdmin &&
    (sprint.status === SprintStatusEnum.Active ||
      sprint.status === SprintStatusEnum.Closed);
  const showStart =
    isManagerOrAdmin && sprint.status === SprintStatusEnum.Planned;
  const showComplete =
    isManagerOrAdmin && sprint.status === SprintStatusEnum.Active;

  return (
    <>
      <BacklogItemCount count={issueCount} />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="size-8 cursor-pointer"
            aria-label={`New work item in ${sprint.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onCreateIssue(sprint.id);
            }}
          >
            <Plus className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">New work item</TooltipContent>
      </Tooltip>

      {showSummary ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="size-8 cursor-pointer"
              aria-label="Summary report"
              onClick={(event) => {
                event.stopPropagation();
                openSprintSummaryReport(sprint.id);
              }}
            >
              <BarChart3 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Summary report</TooltipContent>
        </Tooltip>
      ) : null}

      {showStart ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              className="size-8 cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
              aria-label="Start sprint"
              onClick={(event) => {
                event.stopPropagation();
                onStartSprint(sprint.id);
              }}
            >
              <Play className="size-3.5 fill-current" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Start sprint</TooltipContent>
        </Tooltip>
      ) : null}

      {showComplete ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              className="size-8 cursor-pointer bg-sky-600 text-white hover:bg-sky-700"
              aria-label="Complete sprint"
              onClick={(event) => {
                event.stopPropagation();
                onCompleteSprint(sprint.id);
              }}
            >
              <Check className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Complete sprint</TooltipContent>
        </Tooltip>
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
  onCreateIssue,
  onStartSprint,
  onCompleteSprint,
  onSelectItem,
  onItemDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: Readonly<BacklogSprintCardProps>) {
  return (
    <Card className="border-border/70 gap-0 overflow-visible py-0 shadow-sm transition-all duration-200">
      <div className="bg-muted/30 hover:bg-muted/50 border-border/50 flex flex-row items-center justify-between gap-2 rounded-t-xl border-b px-4 py-3 transition-colors">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 cursor-pointer"
            onClick={() => onToggle(sprint.id)}
          >
            {isCollapsed ? (
              <ChevronRight className="text-muted-foreground size-4" />
            ) : (
              <ChevronDown className="text-muted-foreground size-4" />
            )}
          </Button>

          <BacklogSprintDetailsPopover sprint={sprint} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SprintCardActions
            sprint={sprint}
            issueCount={issueCount}
            isManagerOrAdmin={isManagerOrAdmin}
            onCreateIssue={onCreateIssue}
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
