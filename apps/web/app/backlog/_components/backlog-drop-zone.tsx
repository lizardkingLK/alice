'use client';

import type React from 'react';
import { cn } from '@repo/ui/lib/utils';
import { HelpCircle } from '@repo/ui/lib/icons';
import { BacklogIssueRow } from '@/app/backlog/_components/backlog-issue-row';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { Project as DbProject } from '@/app/projects/_services/projects.service';
import type { BacklogAssignee } from '@/app/backlog/_helpers/backlog-item-utils';

/* eslint-disable no-unused-vars */
type BacklogDropZoneProps = {
  readonly items: DbWorkItem[];
  readonly projects: DbProject[];
  readonly projectMembers: readonly BacklogAssignee[];
  readonly targetId: string | null;
  readonly isDragOver: boolean;
  readonly minHeightClass: string;
  readonly emptyMessage: string;
  readonly emptyPaddingClass?: string;
  readonly emptyIconClass?: string;
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

export function BacklogDropZone({
  items,
  projects,
  projectMembers,
  targetId,
  isDragOver,
  minHeightClass,
  emptyMessage,
  emptyPaddingClass = 'py-6',
  emptyIconClass = 'mb-1.5 h-5 w-5',
  onSelectItem,
  onItemDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: Readonly<BacklogDropZoneProps>) {
  return (
    <div
      onDragOver={(e) => onDragOver(e, targetId)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, targetId)}
      className={cn(
        minHeightClass,
        '@container/backlog-pane space-y-1.5 p-3 transition-all duration-200',
        isDragOver
          ? 'border-primary/30 bg-primary/5 scale-[0.99] rounded-lg border-2 border-dashed'
          : 'bg-card'
      )}
    >
      {items.length === 0 ? (
        <div
          className={cn(
            'text-muted-foreground flex flex-col items-center justify-center text-center text-xs',
            emptyPaddingClass
          )}
        >
          <HelpCircle
            className={cn('text-muted-foreground/40', emptyIconClass)}
          />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        items.map((item) => (
          <BacklogIssueRow
            key={item.id}
            item={item}
            projects={projects}
            projectMembers={projectMembers}
            onSelect={onSelectItem}
            onDragStart={onItemDragStart}
          />
        ))
      )}
    </div>
  );
}
