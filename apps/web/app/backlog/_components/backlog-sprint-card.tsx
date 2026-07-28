'use client';

import type React from 'react';
import { cn } from '@repo/ui/lib/utils';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Play,
} from '@repo/ui/lib/icons';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Card } from '@repo/ui/components/ui/card';
import { Separator } from '@repo/ui/components/ui/separator';
import { BacklogDropZone } from '@/app/backlog/_components/backlog-drop-zone';
import { formatDateRange } from '@/app/backlog/_helpers/backlog-item-utils';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { Project as DbProject } from '@/app/projects/_services/projects.service';
import type { Sprint } from '@/app/sprints/_services/sprints.service';

const SPRINT_STATUS_BADGE: Partial<
  Record<Sprint['status'], { label: string; className: string }>
> = {
  Ongoing: {
    label: 'Ongoing',
    className:
      'border-blue-500/20 bg-blue-500/10 px-2 py-0 font-semibold text-blue-600 dark:text-blue-400',
  },
  Completed: {
    label: 'Completed',
    className:
      'border-emerald-500/20 bg-emerald-500/10 px-2 py-0 font-semibold text-emerald-600 dark:text-emerald-400',
  },
  'Not Started': {
    label: 'Planned',
    className:
      'border-zinc-500/20 bg-zinc-500/10 px-2 py-0 font-semibold text-zinc-600 dark:text-zinc-400',
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

export function BacklogSprintCard({
  sprint,
  items,
  issueCount,
  isCollapsed,
  isDragOver,
  isManagerOrAdmin,
  projects,
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
        'border-border/70 overflow-hidden shadow-sm transition-all duration-200',
        sprint.status === 'Ongoing'
          ? 'border-l-4 border-l-blue-500 dark:border-l-blue-600'
          : 'border-l-4 border-l-zinc-300 dark:border-l-zinc-700'
      )}
    >
      <div className="bg-muted/30 hover:bg-muted/50 border-border/50 flex flex-col justify-between gap-3 border-b px-4 py-3 transition-colors md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            onClick={() => onToggle(sprint.id)}
          >
            {isCollapsed ? (
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            )}
          </Button>

          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span
                className="text-foreground max-w-45 truncate font-semibold sm:max-w-[320px] md:max-w-120"
                title={sprint.name}
              >
                {sprint.name}
              </span>
              {statusBadge && (
                <Badge variant="outline" className={statusBadge.className}>
                  {statusBadge.label}
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDateRange(sprint.startDate, sprint.endDate)}</span>
              {sprint.project && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {sprint.project.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 md:flex-nowrap">
          {sprint.status === 'Completed' ? (
            isManagerOrAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 cursor-pointer border-indigo-500/30 bg-indigo-500/10 text-xs font-semibold text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-400"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/sprints/${sprint.id}/report`, '_blank', 'noopener,noreferrer');
                }}
              >
                Summary Report
              </Button>
            )
          ) : (
            <>
              <div className="mr-2 flex items-center gap-1.5">
                <span className="text-muted-foreground bg-muted/65 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  {issueCount} issue{issueCount === 1 ? '' : 's'}
                </span>
              </div>

              <Separator orientation="vertical" className="hidden h-6 md:block" />

              {isManagerOrAdmin && sprint.status === 'Ongoing' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 cursor-pointer border-indigo-500/30 bg-indigo-500/10 text-xs font-semibold text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/sprints/${sprint.id}/report`, '_blank', 'noopener,noreferrer');
                  }}
                >
                  Summary Report
                </Button>
              )}

              {isManagerOrAdmin && sprint.status === 'Not Started' && (
                <Button
                  size="sm"
                  onClick={() => onStartSprint(sprint.id)}
                  className="h-8 cursor-pointer bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Play className="mr-1 h-3 w-3 fill-current" />
                  Start Sprint
                </Button>
              )}
              {isManagerOrAdmin && sprint.status === 'Ongoing' && (
                <Button
                  size="sm"
                  onClick={() => onCompleteSprint(sprint.id)}
                  className="h-8 cursor-pointer bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Complete Sprint
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <BacklogDropZone
          items={items}
          projects={projects}
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
      )}
    </Card>
  );
}
