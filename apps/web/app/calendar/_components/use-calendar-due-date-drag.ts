'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from 'react';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { updateWorkItem } from '@/app/work-items/_services/work-items.mutations.client';
import { ApiError } from '@/lib/api/api-fetch.helper';
import {
  isBoardMoveOptimisticLockError,
  readBoardMoveConflictServerRow,
  toastWorkItemDnDConflict,
} from '@/app/board/_helpers/board-move-conflict-toast';
import {
  applyRealtimeWorkItemRow,
  mergeWorkItemRealtimeRow,
} from '@/lib/work-items/apply-realtime-work-item-row';
import { useWorkItemsRealtime } from '@/lib/work-items/use-work-items-realtime';
import {
  PAST_DUE_DATE_MESSAGE,
  toLocalYYYYMMDD,
} from '@/app/calendar/_components/calendar-utils';

const DUE_DATE_FIELDS = ['due_date', 'updated_by'] as const;

const CALENDAR_CONFLICT_TITLE = 'Someone else updated this item';
const CALENDAR_CONFLICT_DESCRIPTION =
  'The calendar was updated to the latest due date.';

type UseCalendarDueDateDragOptions = {
  readonly localWorkItems: DbWorkItem[];
  readonly setLocalWorkItems: Dispatch<SetStateAction<DbWorkItem[]>>;
  readonly setItemToEdit: Dispatch<SetStateAction<DbWorkItem | null>>;
  readonly userId: string | null;
  /** When set, filters the realtime channel to that project. */
  readonly projectId?: string | null;
  /** Resolve items that may live outside the scheduled month cache (unscheduled). */
  // eslint-disable-next-line no-unused-vars -- resolve callback
  readonly resolveWorkItem?: (itemId: string) => DbWorkItem | undefined;
  /** Fired when an unscheduled item gains a due date and enters the month cache. */
  // eslint-disable-next-line no-unused-vars -- callback
  readonly onItemScheduled?: (itemId: string) => void;
};

function dueDateDay(value: string | null | undefined): string | null {
  return value?.split('T')[0] ?? null;
}

export function useCalendarDueDateDrag({
  localWorkItems,
  setLocalWorkItems,
  setItemToEdit,
  userId,
  projectId = null,
  resolveWorkItem,
  onItemScheduled,
}: UseCalendarDueDateDragOptions) {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [activeDropDate, setActiveDropDate] = useState<string | null>(null);
  const [dueDateWarning, setDueDateWarning] = useState('');
  const [dueDateWarningOpen, setDueDateWarningOpen] = useState(false);
  const [pendingDueDateIds, setPendingDueDateIds] = useState<Set<string>>(
    () => new Set()
  );
  const suppressNextItemClickRef = useRef(false);
  const dueDateWarningClearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (dueDateWarningClearTimerRef.current !== null) {
        window.clearTimeout(dueDateWarningClearTimerRef.current);
      }
    };
  }, []);

  const showDueDateWarning = useCallback((message: string) => {
    if (dueDateWarningClearTimerRef.current !== null) {
      window.clearTimeout(dueDateWarningClearTimerRef.current);
      dueDateWarningClearTimerRef.current = null;
    }
    setDueDateWarning(message);
    setDueDateWarningOpen(true);
  }, []);

  const closeDueDateWarning = useCallback(() => {
    setDueDateWarningOpen(false);
    if (dueDateWarningClearTimerRef.current !== null) {
      window.clearTimeout(dueDateWarningClearTimerRef.current);
    }
    dueDateWarningClearTimerRef.current = window.setTimeout(() => {
      setDueDateWarning('');
      dueDateWarningClearTimerRef.current = null;
    }, 220);
  }, []);

  const syncWorkItemDueDate = useCallback(
    (id: string, dueDate: string | null, updatedAt?: string) => {
      setLocalWorkItems((previous) => {
        const index = previous.findIndex((item) => item.id === id);
        if (index >= 0) {
          return previous.map((item) =>
            item.id === id
              ? {
                  ...item,
                  due_date: dueDate,
                  ...(updatedAt ? { updated_at: updatedAt } : {}),
                }
              : item
          );
        }
        const source = resolveWorkItem?.(id);
        if (!source || !dueDate) {
          return previous;
        }
        return [
          {
            ...source,
            due_date: dueDate,
            ...(updatedAt ? { updated_at: updatedAt } : {}),
          },
          ...previous,
        ];
      });
      if (dueDate) {
        onItemScheduled?.(id);
      }
      setItemToEdit((previous) =>
        previous?.id === id
          ? {
              ...previous,
              due_date: dueDate,
              ...(updatedAt ? { updated_at: updatedAt } : {}),
            }
          : previous
      );
    },
    [onItemScheduled, resolveWorkItem, setItemToEdit, setLocalWorkItems]
  );

  const applyDueDateRow = useCallback(
    (row: Partial<DbWorkItem> & { id: string }, force = false) => {
      setLocalWorkItems((previous) => {
        if (force) {
          const index = previous.findIndex((item) => item.id === row.id);
          if (index < 0) {
            const source = resolveWorkItem?.(row.id);
            if (!source) {
              return previous;
            }
            const merged = mergeWorkItemRealtimeRow(
              source,
              row,
              DUE_DATE_FIELDS
            );
            if (merged.due_date) {
              onItemScheduled?.(row.id);
            }
            return [merged, ...previous];
          }
          const next = [...previous];
          next[index] = mergeWorkItemRealtimeRow(
            previous[index]!,
            row,
            DUE_DATE_FIELDS
          );
          return next;
        }
        return (
          applyRealtimeWorkItemRow(previous, row, DUE_DATE_FIELDS) ?? previous
        );
      });
      setItemToEdit((previous) => {
        if (!previous || previous.id !== row.id) {
          return previous;
        }
        return mergeWorkItemRealtimeRow(previous, row, DUE_DATE_FIELDS);
      });
      setPendingDueDateIds((previous) => {
        if (!previous.has(row.id)) {
          return previous;
        }
        const next = new Set(previous);
        next.delete(row.id);
        return next;
      });
    },
    [onItemScheduled, resolveWorkItem, setItemToEdit, setLocalWorkItems]
  );

  useWorkItemsRealtime({
    enabled: Boolean(userId),
    channelPrefix: 'calendar-work-items',
    projectId: projectId || null,
    onRow: applyDueDateRow,
  });

  const applyDueDateChange = useCallback(
    (itemId: string, targetDate: string) => {
      const currentItem =
        localWorkItems.find((item) => item.id === itemId) ??
        resolveWorkItem?.(itemId);
      if (!currentItem || pendingDueDateIds.has(itemId)) {
        return;
      }

      // Done work items are read-only. Ignore stale/existing calendar entries
      // before applying an optimistic due-date change or calling the API.
      if (currentItem.status === 'Done') {
        return;
      }

      const previousDueDate = currentItem.due_date;
      const previousDateOnly = dueDateDay(previousDueDate);
      if (previousDateOnly === targetDate) {
        return;
      }

      if (targetDate < toLocalYYYYMMDD(new Date())) {
        showDueDateWarning(PAST_DUE_DATE_MESSAGE);
        return;
      }

      setPendingDueDateIds((previous) => new Set(previous).add(itemId));
      syncWorkItemDueDate(itemId, targetDate);

      const formData = new FormData();
      formData.set('due_date', targetDate);
      const expectedUpdatedAt = currentItem.updated_at;

      updateWorkItem(itemId, formData, expectedUpdatedAt)
        .then((response) => {
          if (response.error || !response.data) {
            syncWorkItemDueDate(itemId, previousDueDate);
            showDueDateWarning(
              typeof response.error === 'string'
                ? response.error
                : 'Failed to update work item due date.'
            );
            return;
          }
          const updated = response.data;
          syncWorkItemDueDate(
            itemId,
            dueDateDay(updated.due_date) ?? targetDate,
            updated.updated_at
          );
        })
        .catch((error: unknown) => {
          if (isBoardMoveOptimisticLockError(error)) {
            toastWorkItemDnDConflict(
              CALENDAR_CONFLICT_TITLE,
              CALENDAR_CONFLICT_DESCRIPTION
            );
            const serverRow = readBoardMoveConflictServerRow(error);
            if (serverRow) {
              applyDueDateRow(serverRow, true);
            } else {
              syncWorkItemDueDate(itemId, previousDueDate);
            }
            return;
          }

          syncWorkItemDueDate(itemId, previousDueDate);
          let message: string;
          if (error instanceof ApiError) {
            message = error.message;
          } else if (error instanceof Error) {
            message = error.message;
          } else {
            message = 'Failed to update work item due date.';
          }
          showDueDateWarning(message);
        })
        .finally(() => {
          setPendingDueDateIds((previous) => {
            const next = new Set(previous);
            next.delete(itemId);
            return next;
          });
        });
    },
    [
      applyDueDateRow,
      localWorkItems,
      pendingDueDateIds,
      resolveWorkItem,
      showDueDateWarning,
      syncWorkItemDueDate,
    ]
  );

  const handleItemDragStart = (event: DragEvent, itemId: string): void => {
    if (pendingDueDateIds.has(itemId)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('text/plain', itemId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedItemId(itemId);
  };

  const handleItemDragEnd = (): void => {
    setDraggedItemId(null);
    setActiveDropDate(null);
    suppressNextItemClickRef.current = true;
    window.setTimeout(() => {
      suppressNextItemClickRef.current = false;
    }, 0);
  };

  const handleDayDragOver = (event: DragEvent, dateString: string): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (activeDropDate !== dateString) {
      setActiveDropDate(dateString);
    }
  };

  const handleDayDragLeave = (dateString: string): void => {
    if (activeDropDate === dateString) {
      setActiveDropDate(null);
    }
  };

  const handleDayDrop = (event: DragEvent, dateString: string): void => {
    event.preventDefault();
    event.stopPropagation();
    const itemId = event.dataTransfer.getData('text/plain') || draggedItemId;
    if (itemId && !pendingDueDateIds.has(itemId)) {
      applyDueDateChange(itemId, dateString);
    }
    setDraggedItemId(null);
    setActiveDropDate(null);
  };

  const shouldSuppressItemClick = (): boolean => {
    if (suppressNextItemClickRef.current) {
      suppressNextItemClickRef.current = false;
      return true;
    }
    return false;
  };

  return {
    draggedItemId,
    activeDropDate,
    pendingDueDateIds,
    dueDateWarning,
    dueDateWarningOpen,
    closeDueDateWarning,
    handleItemDragStart,
    handleItemDragEnd,
    handleDayDragOver,
    handleDayDragLeave,
    handleDayDrop,
    shouldSuppressItemClick,
  };
}
