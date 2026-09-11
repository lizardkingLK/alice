'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type RefObject,
} from 'react';
import { RefreshCw, X } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import { Spinner } from '@repo/ui/components/ui/spinner';
import { cn } from '@repo/ui/lib/utils';
import type { Project } from '@/app/projects/_services/projects.mutations.client';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { CalendarWorkItemList } from '@/app/calendar/_components/calendar-work-item-list';
import { matchesCalendarWorkItemSearch } from '@/app/calendar/_components/calendar-utils';
import {
  fetchCalendarUnscheduledWorkItems,
  type CalendarListFilterInput,
} from '@/app/calendar/_services/calendar.reads.actions';
import { Pagination } from '@/components/pagination';
import { SearchInput } from '@/components/search-input';

type CalendarUnscheduledPanelProps = {
  readonly filters: CalendarListFilterInput;
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
  readonly refreshKey?: string | number;
  readonly panelRef?: RefObject<CalendarUnscheduledPanelHandle | null>;
};

export type CalendarUnscheduledPanelHandle = {
  // eslint-disable-next-line no-unused-vars -- public API
  resolveItem: (itemId: string) => DbWorkItem | undefined;
  // eslint-disable-next-line no-unused-vars -- public API
  removeItem: (itemId: string) => void;
};

function findWorkItemById(
  items: readonly DbWorkItem[],
  itemId: string
): DbWorkItem | undefined {
  return items.find((item) => item.id === itemId);
}

function excludeWorkItemById(
  items: readonly DbWorkItem[],
  itemId: string
): DbWorkItem[] {
  return items.filter((item) => item.id !== itemId);
}

function UnscheduledPanelListContent({
  loading,
  pageItems,
  filteredCount,
  cachedCount,
  projects,
  draggedItemId,
  pendingDueDateIds,
  onDragStart,
  onDragEnd,
  onOpenItem,
}: Readonly<{
  loading: boolean;
  pageItems: readonly DbWorkItem[];
  filteredCount: number;
  cachedCount: number;
  projects: readonly Project[];
  draggedItemId: string | null;
  pendingDueDateIds: ReadonlySet<string>;
  onDragStart: CalendarUnscheduledPanelProps['onDragStart'];
  onDragEnd: CalendarUnscheduledPanelProps['onDragEnd'];
  onOpenItem: CalendarUnscheduledPanelProps['onOpenItem'];
}>) {
  if (loading && cachedCount === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner
          className="text-muted-foreground size-6"
          aria-label="Loading unscheduled work items"
        />
      </div>
    );
  }

  if (cachedCount === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No unscheduled work items match the current filters.
      </p>
    );
  }

  if (filteredCount === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No unscheduled items match your search.
      </p>
    );
  }

  return (
    <CalendarWorkItemList
      items={pageItems}
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
  filters,
  projects,
  draggedItemId,
  pendingDueDateIds,
  className,
  onClose,
  onDragStart,
  onDragEnd,
  onOpenItem,
  refreshKey = 0,
  panelRef,
}: Readonly<CalendarUnscheduledPanelProps>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [items, setItems] = useState<DbWorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const requestIdRef = useRef(0);

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        matchesCalendarWorkItemSearch(item, searchQuery, projects)
      ),
    [items, projects, searchQuery]
  );

  const totalCount = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageItems = filteredItems.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const loadUnscheduled = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const next = await fetchCalendarUnscheduledWorkItems({ filters });
      if (requestId !== requestIdRef.current) {
        return;
      }
      setItems(next);
      setCurrentPage(1);
    } catch {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setItems([]);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [filters]);

  const resolveItem = useCallback((itemId: string) => {
    return findWorkItemById(itemsRef.current, itemId);
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((previous) => excludeWorkItemById(previous, itemId));
  }, []);

  useEffect(() => {
    if (!panelRef) {
      return;
    }
    panelRef.current = {
      resolveItem,
      removeItem,
    };
    return () => {
      panelRef.current = null;
    };
  }, [panelRef, removeItem, resolveItem]);

  useEffect(() => {
    void loadUnscheduled();
  }, [loadUnscheduled, refreshKey, refreshNonce]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

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
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={loading}
            onClick={() => setRefreshNonce((value) => value + 1)}
            aria-label="Refresh unscheduled work items"
            title="Refresh"
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
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
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 p-3">
          <UnscheduledPanelListContent
            loading={loading}
            pageItems={pageItems}
            filteredCount={totalCount}
            cachedCount={items.length}
            projects={projects}
            draggedItemId={draggedItemId}
            pendingDueDateIds={pendingDueDateIds}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onOpenItem={onOpenItem}
          />
        </div>
      </div>
      {totalCount > 0 ? (
        <div className="border-border shrink-0 border-t px-3 py-3 sm:px-4">
          <Pagination
            totalCount={totalCount}
            page={safePage}
            limit={pageSize}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            onLimitChange={(limit) => {
              setPageSize(limit);
              setCurrentPage(1);
            }}
            label="work items"
            compact
            layout="stacked"
          />
        </div>
      ) : null}
    </aside>
  );
}
