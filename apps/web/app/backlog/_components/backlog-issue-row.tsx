'use client';

import type React from 'react';
import { cn } from '@repo/ui/lib/utils';
import { GripVertical } from '@repo/ui/lib/icons';
import { Avatar, AvatarFallback } from '@repo/ui/components/ui/avatar';
import { Badge } from '@repo/ui/components/ui/badge';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { Project as DbProject } from '@/app/projects/_services/projects.service';
import {
  BACKLOG_PRIORITY_STYLES,
  BACKLOG_TYPE_STYLES,
  getInitials,
  mapPriority,
  projectDisplayKey,
} from '@/app/backlog/_helpers/backlog-item-utils';

/* eslint-disable no-unused-vars */
type BacklogIssueRowProps = {
  readonly item: DbWorkItem;
  readonly projects: DbProject[];
  readonly onSelect: (item: DbWorkItem) => void;
  readonly onDragStart: (event: React.DragEvent, id: string) => void;
};
/* eslint-enable no-unused-vars */

export function BacklogIssueRow({
  item,
  projects,
  onSelect,
  onDragStart,
}: Readonly<BacklogIssueRowProps>) {
  const projectKey = projects.find((p) => p.id === item.project_id)?.key;
  const displayKey = projectDisplayKey(projectKey, item.id);
  const normalizedPriority = mapPriority(item.priority);

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onClick={() => onSelect(item)}
      className={cn(
        'group border-border/60 relative flex w-full items-center justify-between gap-4 rounded-lg border px-3 py-2 text-left font-normal',
        'bg-card/45 hover:bg-muted/30 cursor-grab hover:border-indigo-500/30 active:cursor-grabbing',
        'shadow-sm transition-all duration-150',
        'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Grab Handle */}
        <div className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Issue Type Indicator */}
        <Badge
          variant="outline"
          className={cn(
            'h-4 border px-1.5 py-0 text-[9px] uppercase',
            BACKLOG_TYPE_STYLES[item.type]
          )}
        >
          {item.type}
        </Badge>

        {/* Key */}
        <span className="text-muted-foreground min-w-17.5 font-mono text-xs font-semibold tracking-tight whitespace-nowrap">
          {displayKey}
        </span>

        {/* Title */}
        <span className="text-foreground max-w-md truncate text-sm font-medium transition-colors group-hover:text-indigo-600 sm:max-w-xl dark:group-hover:text-indigo-400">
          {item.title}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Status */}
        <WorkItemStatusBadge status={item.status} />

        {/* Priority Badge */}
        <Badge
          variant="outline"
          className={cn(
            'h-4 border px-1.5 py-0 text-[9px] font-medium whitespace-nowrap capitalize',
            BACKLOG_PRIORITY_STYLES[normalizedPriority]
          )}
        >
          {item.priority}
        </Badge>

        {/* Assignee Avatar */}
        <Avatar size="sm" className="border-border/80 size-6 border">
          <AvatarFallback className="bg-muted-foreground/15 text-muted-foreground text-[9px] font-semibold">
            {getInitials(item.assignee?.name)}
          </AvatarFallback>
        </Avatar>
      </div>
    </button>
  );
}
