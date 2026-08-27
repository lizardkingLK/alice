'use client';

import type { DragEvent } from 'react';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import { cn } from '@repo/ui/lib/utils';
import type { Project } from '@/app/projects/_services/projects.service';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { CalendarDayItem } from '@/app/calendar/_components/calendar-day-item';
import type { CalendarDayCell } from '@/app/calendar/_components/calendar-utils';
import { DAYS_OF_WEEK } from '@/app/calendar/_components/calendar-constants';

type CalendarMonthGridProps = {
  readonly calendarDays: readonly CalendarDayCell[];
  readonly itemsByDate: Readonly<Record<string, DbWorkItem[]>>;
  readonly projects: readonly Project[];
  readonly activeDropDate: string | null;
  readonly draggedItemId: string | null;
  readonly pendingDueDateIds: ReadonlySet<string>;
  // eslint-disable-next-line no-unused-vars -- day open handler
  readonly onOpenDay: (dateString: string) => void;
  // eslint-disable-next-line no-unused-vars -- drag handlers
  readonly onItemDragStart: (event: DragEvent, itemId: string) => void;
  readonly onItemDragEnd: () => void;
  // eslint-disable-next-line no-unused-vars -- drag over/leave/drop
  readonly onDayDragOver: (event: DragEvent, dateString: string) => void;
  // eslint-disable-next-line no-unused-vars -- drag leave
  readonly onDayDragLeave: (dateString: string) => void;
  // eslint-disable-next-line no-unused-vars -- drop
  readonly onDayDrop: (event: DragEvent, dateString: string) => void;
  // eslint-disable-next-line no-unused-vars -- open item
  readonly onOpenItem: (item: DbWorkItem) => void;
};

export function CalendarMonthGrid({
  calendarDays,
  itemsByDate,
  projects,
  activeDropDate,
  draggedItemId,
  pendingDueDateIds,
  onOpenDay,
  onItemDragStart,
  onItemDragEnd,
  onDayDragOver,
  onDayDragLeave,
  onDayDrop,
  onOpenItem,
}: Readonly<CalendarMonthGridProps>) {
  return (
    <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
      <div className="bg-muted grid shrink-0 grid-cols-7 border-b">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="text-muted-foreground py-1.5 text-center text-[10px] font-semibold tracking-wider uppercase sm:text-xs"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="bg-border grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-px">
        {calendarDays.map((dayCell) => {
          const dayItems = itemsByDate[dayCell.dateString] || [];
          const isDropTarget = activeDropDate === dayCell.dateString;

          return (
            <div
              key={dayCell.dateString}
              onDragOver={(event) => onDayDragOver(event, dayCell.dateString)}
              onDragLeave={() => onDayDragLeave(dayCell.dateString)}
              onDrop={(event) => onDayDrop(event, dayCell.dateString)}
              className={cn(
                'bg-card group hover:bg-accent/15 flex h-full min-h-0 w-full flex-col gap-1 p-1.5 text-left transition-colors duration-150 sm:p-2',
                !dayCell.isCurrentMonth &&
                  'bg-muted/30 text-muted-foreground/50',
                isDropTarget &&
                  'bg-primary/10 ring-primary/40 ring-2 ring-inset'
              )}
            >
              <button
                type="button"
                onClick={() => onOpenDay(dayCell.dateString)}
                className="focus-visible:ring-ring flex w-full shrink-0 items-center justify-between rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-offset-0"
              >
                <span
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full text-[10px] font-bold select-none sm:size-6 sm:text-xs',
                    dayCell.isToday &&
                      'bg-primary text-primary-foreground font-extrabold shadow-sm',
                    !dayCell.isToday &&
                      'text-foreground/80 group-hover:text-foreground'
                  )}
                >
                  {dayCell.dayNum}
                </span>
                {dayItems.length > 0 ? (
                  <span className="text-muted-foreground text-[10px] font-medium tabular-nums">
                    {dayItems.length}
                  </span>
                ) : null}
              </button>

              <ScrollArea type="hover" className="h-0 min-h-0 flex-1">
                <div className="flex flex-col gap-0.5 pr-2.5">
                  {dayItems.map((item) => (
                    <CalendarDayItem
                      key={item.id}
                      item={item}
                      compact
                      projects={projects}
                      isDragging={draggedItemId === item.id}
                      isPending={pendingDueDateIds.has(item.id)}
                      onDragStart={onItemDragStart}
                      onDragEnd={onItemDragEnd}
                      onOpen={onOpenItem}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
