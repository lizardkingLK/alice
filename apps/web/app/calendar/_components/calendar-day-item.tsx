'use client';

import type { DragEvent } from 'react';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import { WorkItemTypeEnum } from '@repo/types';
import type { Project } from '@/app/projects/_services/projects.service';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import { WorkItemTypeBadge } from '@/app/work-items/_components/workItem-badge-type';
import { UserAvatar } from '@/components/user-avatar';

type CalendarDayItemProps = {
  readonly item: DbWorkItem;
  readonly compact: boolean;
  readonly projects: readonly Project[];
  readonly isDragging: boolean;
  readonly isPending: boolean;
  // eslint-disable-next-line no-unused-vars -- drag handler
  readonly onDragStart: (event: DragEvent, itemId: string) => void;
  readonly onDragEnd: () => void;
  // eslint-disable-next-line no-unused-vars -- click handler
  readonly onOpen: (item: DbWorkItem) => void;
};

export function CalendarDayItem({
  item,
  compact,
  projects,
  isDragging,
  isPending,
  onDragStart,
  onDragEnd,
  onOpen,
}: Readonly<CalendarDayItemProps>) {
  const isIssue = item.type === WorkItemTypeEnum.Issue;
  const isStory = item.type === WorkItemTypeEnum.Story;

  if (compact) {
    return (
      <button
        type="button"
        draggable={!isPending}
        onDragStart={(event) => onDragStart(event, item.id)}
        onDragEnd={onDragEnd}
        onClick={(event) => {
          event.stopPropagation();
          if (isPending) {
            return;
          }
          onOpen(item);
        }}
        className={cn(
          'hover:bg-accent/80 w-full min-w-0 cursor-grab rounded px-1 py-0.5 text-left transition-colors active:cursor-grabbing',
          isIssue && 'bg-red-500/10',
          isStory && 'bg-emerald-500/10',
          !isIssue && !isStory && 'bg-blue-500/10',
          (isDragging || isPending) && 'opacity-40',
          isPending && 'cursor-wait'
        )}
      >
        <TruncatedText className="text-foreground block text-[10px] leading-tight font-medium sm:text-[11px]">
          {item.title}
        </TruncatedText>
      </button>
    );
  }

  const projectKey =
    item.project?.key ??
    projects.find((p) => p.id === item.project_id)?.key ??
    'ITEM';
  const displayKey = `${projectKey}-${item.id.slice(-4)}`;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'border-border bg-card flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border p-3 text-left shadow-sm transition-all duration-150 select-none',
        'hover:border-primary/30 hover:translate-x-0.5 hover:shadow-md',
        isIssue && 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10',
        isStory &&
          'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10',
        !isIssue &&
          !isStory &&
          'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <WorkItemTypeBadge type={item.type} compact />
        <span className="text-muted-foreground shrink-0 font-mono text-xs font-semibold">
          {displayKey}
        </span>
        <span className="text-foreground truncate text-sm font-medium">
          {item.title}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
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
