'use client';

import type { DragEvent } from 'react';
import { cn } from '@repo/ui/lib/utils';
import type { Project } from '@/app/projects/_services/projects.mutations.client';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { CalendarDayItem } from '@/app/calendar/_components/calendar-day-item';

type CalendarWorkItemListProps = {
  readonly items: readonly DbWorkItem[];
  readonly projects: readonly Project[];
  readonly compact?: boolean;
  readonly enableDrag?: boolean;
  readonly className?: string;
  readonly draggedItemId: string | null;
  readonly pendingDueDateIds: ReadonlySet<string>;
  // eslint-disable-next-line no-unused-vars -- drag handler
  readonly onDragStart: (event: DragEvent, itemId: string) => void;
  readonly onDragEnd: () => void;
  // eslint-disable-next-line no-unused-vars -- open item
  readonly onOpenItem: (item: DbWorkItem) => void;
};

export function CalendarWorkItemList({
  items,
  projects,
  compact = true,
  enableDrag,
  className,
  draggedItemId,
  pendingDueDateIds,
  onDragStart,
  onDragEnd,
  onOpenItem,
}: Readonly<CalendarWorkItemListProps>) {
  const dragEnabled = enableDrag ?? compact;

  return (
    <div className={cn('flex flex-col', className)}>
      {items.map((item) => (
        <CalendarDayItem
          key={item.id}
          item={item}
          compact={compact}
          enableDrag={dragEnabled}
          projects={projects}
          isDragging={draggedItemId === item.id}
          isPending={pendingDueDateIds.has(item.id)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onOpen={onOpenItem}
        />
      ))}
    </div>
  );
}
