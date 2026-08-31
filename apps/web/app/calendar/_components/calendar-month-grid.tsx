'use client';

import type { DragEvent } from 'react';
import { cn } from '@repo/ui/lib/utils';
import type { Project } from '@/app/projects/_services/projects.mutations.client';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { CalendarDayOverflowPopover } from '@/app/calendar/_components/calendar-day-overflow-popover';
import { CalendarWorkItemList } from '@/app/calendar/_components/calendar-work-item-list';
import type { CalendarDayCell } from '@/app/calendar/_components/calendar-utils';
import {
  DAYS_OF_WEEK,
  MAX_VISIBLE_ITEMS_IN_DAY_CELL,
} from '@/app/calendar/_components/calendar-constants';

type CalendarMonthGridProps = {
  readonly className?: string;
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
  className,
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
    <div
      className={cn(
        'border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border',
        className
      )}
    >
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
          const visibleItems = dayItems.slice(0, MAX_VISIBLE_ITEMS_IN_DAY_CELL);
          const overflowCount = dayItems.length - visibleItems.length;
          const isDropTarget = activeDropDate === dayCell.dateString;

          const dayLabel = new Date(
            `${dayCell.dateString}T00:00:00`
          ).toLocaleDateString(undefined, { dateStyle: 'full' });

          return (
            <div
              key={dayCell.dateString}
              onDragOver={(event) => onDayDragOver(event, dayCell.dateString)}
              onDragLeave={() => onDayDragLeave(dayCell.dateString)}
              onDrop={(event) => onDayDrop(event, dayCell.dateString)}
              className={cn(
                'bg-card group relative flex h-full min-h-0 w-full flex-col gap-1 p-1.5 text-left transition-colors duration-150 sm:p-2',
                !dayCell.isCurrentMonth &&
                  'bg-muted/30 text-muted-foreground/50',
                isDropTarget &&
                  'bg-primary/10 ring-primary/40 ring-2 ring-inset'
              )}
            >
              <button
                type="button"
                aria-label={`Open ${dayLabel}`}
                onClick={() => onOpenDay(dayCell.dateString)}
                className="hover:bg-accent/15 absolute inset-0 z-0 cursor-pointer rounded-none border-0 bg-transparent p-0"
              />
              <div className="pointer-events-none relative z-10 flex w-full shrink-0 items-center justify-between">
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
              </div>

              <div className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
                <CalendarWorkItemList
                  items={visibleItems}
                  projects={projects}
                  className="pointer-events-auto gap-0.5"
                  draggedItemId={draggedItemId}
                  pendingDueDateIds={pendingDueDateIds}
                  onDragStart={onItemDragStart}
                  onDragEnd={onItemDragEnd}
                  onOpenItem={onOpenItem}
                />
                {overflowCount > 0 ? (
                  <div className="pointer-events-auto">
                    <CalendarDayOverflowPopover
                      dateString={dayCell.dateString}
                      items={dayItems}
                      overflowCount={overflowCount}
                      projects={projects}
                      draggedItemId={draggedItemId}
                      pendingDueDateIds={pendingDueDateIds}
                      onDragStart={onItemDragStart}
                      onDragEnd={onItemDragEnd}
                      onOpenItem={onOpenItem}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
