'use client';

import type React from 'react';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import { WorkItemTypeBadge } from '@/app/work-items/_components/workItem-badge-type';
import { projectDisplayKey } from '@/app/backlog/_helpers/backlog-item-utils';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { Project as DbProject } from '@/app/projects/_services/projects.service';
import { UserAvatar } from '@/components/user-avatar';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import { GripVertical } from '@repo/ui/lib/icons';

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

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onClick={() => onSelect(item)}
      className={cn(
        'group border-border/60 relative flex w-full min-w-0 flex-col gap-2 rounded-lg border px-3 py-2 text-left font-normal',
        'bg-card hover:bg-muted/30 hover:border-primary/30 cursor-grab active:cursor-grabbing',
        'shadow-sm transition-all duration-150',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden',
        '@md/backlog-pane:flex-row @md/backlog-pane:items-center @md/backlog-pane:justify-between @md/backlog-pane:gap-3'
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="text-muted-foreground/40 group-hover:text-muted-foreground/70 shrink-0 transition-colors">
          <GripVertical className="size-4" />
        </div>

        <WorkItemTypeBadge type={item.type} compact />

        <span className="text-muted-foreground shrink-0 font-mono text-xs font-semibold tracking-tight">
          {displayKey}
        </span>

        <TruncatedText className="text-foreground group-hover:text-primary min-w-0 text-sm font-medium transition-colors">
          {item.title}
        </TruncatedText>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-end @md/backlog-pane:self-auto">
        <WorkItemStatusBadge status={item.status} />
        <PriorityBadge priority={item.priority} />
        <UserAvatar
          name={item.assignee?.name}
          imageUrl={item.assignee?.profile_picture}
          title={item.assignee?.name ?? 'Unassigned'}
        />
      </div>
    </button>
  );
}
