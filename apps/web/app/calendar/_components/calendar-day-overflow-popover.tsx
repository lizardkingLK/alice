'use client';

import type { DragEvent } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@repo/ui/components/ui/popover';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import type { Project } from '@/app/projects/_services/projects.mutations.client';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { CalendarWorkItemList } from '@/app/calendar/_components/calendar-work-item-list';

type CalendarDayOverflowPopoverProps = {
  readonly dateString: string;
  readonly items: readonly DbWorkItem[];
  readonly overflowCount: number;
  readonly projects: readonly Project[];
  readonly draggedItemId: string | null;
  readonly pendingDueDateIds: ReadonlySet<string>;
  // eslint-disable-next-line no-unused-vars -- drag handler
  readonly onDragStart: (event: DragEvent, itemId: string) => void;
  readonly onDragEnd: () => void;
  // eslint-disable-next-line no-unused-vars -- open item
  readonly onOpenItem: (item: DbWorkItem) => void;
};

export function CalendarDayOverflowPopover({
  dateString,
  items,
  overflowCount,
  projects,
  draggedItemId,
  pendingDueDateIds,
  onDragStart,
  onDragEnd,
  onOpenItem,
}: Readonly<CalendarDayOverflowPopoverProps>) {
  const formattedDate = new Date(`${dateString}T00:00:00`).toLocaleDateString(
    undefined,
    { dateStyle: 'full' }
  );

  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-auto w-full justify-start px-1 py-0.5 text-[10px] font-medium sm:text-[11px]"
          onClick={(event) => event.stopPropagation()}
        >
          +{overflowCount} more
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="flex w-72 flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <PopoverHeader className="border-border shrink-0 border-b px-3 py-2">
          <PopoverTitle>{formattedDate}</PopoverTitle>
        </PopoverHeader>
        <ScrollArea
          type="always"
          className="h-64 w-full overflow-hidden"
          onWheel={(event) => event.stopPropagation()}
        >
          <CalendarWorkItemList
            items={items}
            projects={projects}
            className="gap-0.5 p-2"
            draggedItemId={draggedItemId}
            pendingDueDateIds={pendingDueDateIds}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onOpenItem={onOpenItem}
          />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
