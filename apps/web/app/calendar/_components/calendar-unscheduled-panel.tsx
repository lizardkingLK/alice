'use client';

import { useMemo, useState, type DragEvent } from 'react';
import { X } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import { cn } from '@repo/ui/lib/utils';
import type { Project } from '@/app/projects/_services/projects.service';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { CalendarWorkItemList } from '@/app/calendar/_components/calendar-work-item-list';
import { matchesCalendarWorkItemSearch } from '@/app/calendar/_components/calendar-utils';
import { SearchInput } from '@/components/search-input';

type CalendarUnscheduledPanelProps = {
  readonly items: readonly DbWorkItem[];
  readonly projects: readonly Project[];
  readonly draggedItemId: string | null;
  readonly pendingDueDateIds: ReadonlySet<string>;
  readonly className?: string;
  readonly onClose: () => void;
  // eslint-disable-next-line no-unused-vars -- drag handler
  readonly onDragStart: (event: DragEvent, itemId: string) => void;
  readonly onDragEnd: () => void;
  // eslint-disable-next-line no-unused-vars -- open item
  readonly onOpenItem: (item: DbWorkItem) => void;
};

function UnscheduledPanelListContent({
  items,
  filteredItems,
  projects,
  draggedItemId,
  pendingDueDateIds,
  onDragStart,
  onDragEnd,
  onOpenItem,
}: Readonly<{
  items: readonly DbWorkItem[];
  filteredItems: readonly DbWorkItem[];
  projects: readonly Project[];
  draggedItemId: string | null;
  pendingDueDateIds: ReadonlySet<string>;
  onDragStart: CalendarUnscheduledPanelProps['onDragStart'];
  onDragEnd: CalendarUnscheduledPanelProps['onDragEnd'];
  onOpenItem: CalendarUnscheduledPanelProps['onOpenItem'];
}>) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No unscheduled work items match the current filters.
      </p>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No unscheduled items match your search.
      </p>
    );
  }

  return (
    <CalendarWorkItemList
      items={filteredItems}
      projects={projects}
      compact={false}
      enableDrag
      className="gap-2"
      draggedItemId={draggedItemId}
      pendingDueDateIds={pendingDueDateIds}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onOpenItem={onOpenItem}
    />
  );
}

export function CalendarUnscheduledPanel({
  items,
  projects,
  draggedItemId,
  pendingDueDateIds,
  className,
  onClose,
  onDragStart,
  onDragEnd,
  onOpenItem,
}: Readonly<CalendarUnscheduledPanelProps>) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        matchesCalendarWorkItemSearch(item, searchQuery, projects)
      ),
    [items, projects, searchQuery]
  );

  return (
    <aside
      className={cn(
        'border-border bg-card flex min-h-0 flex-col rounded-xl border',
        className
      )}
    >
      <div className="border-border flex shrink-0 items-start justify-between gap-2 border-b p-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Unscheduled</h3>
          <p className="text-muted-foreground text-xs">
            Drag items onto a day to set a due date.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close unscheduled panel"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="border-border shrink-0 border-b px-3 py-3">
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search unscheduled work…"
          enableFocusShortcut={false}
          className="max-w-none"
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 p-3">
          <UnscheduledPanelListContent
            items={items}
            filteredItems={filteredItems}
            projects={projects}
            draggedItemId={draggedItemId}
            pendingDueDateIds={pendingDueDateIds}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onOpenItem={onOpenItem}
          />
        </div>
      </ScrollArea>
    </aside>
  );
}
