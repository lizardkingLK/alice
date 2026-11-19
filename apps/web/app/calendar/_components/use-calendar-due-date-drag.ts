'use client';

import {
  useCallback,
  useEffect,
  useMemo,
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
import { createSerialCoalesceMutationQueue } from '@/lib/work-items/serial-coalesce-mutation-queue';
import { toggleIdInSet } from '@/lib/work-items/toggle-id-in-set';
import { usePendingMutationUnload } from '@/lib/work-items/use-pending-mutation-unload';
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
  const localWorkItemsRef = useRef(localWorkItems);
  localWorkItemsRef.current = localWorkItems;
  const resolveWorkItemRef = useRef(resolveWorkItem);
  resolveWorkItemRef.current = resolveWorkItem;
  const onItemScheduledRef = useRef(onItemScheduled);
  onItemScheduledRef.current = onItemScheduled;

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

  const findItem = useCallback((id: string) => {
    return (
      localWorkItemsRef.current.find((item) => item.id === id) ??
      resolveWorkItemRef.current?.(id)
    );
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
        const source = resolveWorkItemRef.current?.(id);
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
        onItemScheduledRef.current?.(id);
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
    [setItemToEdit, setLocalWorkItems]
  );

  const applyDueDateRow = useCallback(
    (row: Partial<DbWorkItem> & { id: string }, force = false) => {
      if (!force && dueDateQueueRef.current.isPending(row.id)) {
        return;
      }
      setLocalWorkItems((previous) => {
        if (force) {
          const index = previous.findIndex((item) => item.id === row.id);
          if (index < 0) {
            const source = resolveWorkItemRef.current?.(row.id);
            if (!source) {
              return previous;
            }
            const merged = mergeWorkItemRealtimeRow(
              source,
              row,
              DUE_DATE_FIELDS
            );
            if (merged.due_date) {
              onItemScheduledRef.current?.(row.id);
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
          applyRealtimeWorkItemRow(previous, row, DUE_DATE_FIELDS, {
            isFlushPending: (id) => dueDateQueueRef.current.isPending(id),
          }) ?? previous
        );
      });
      setItemToEdit((previous) => {
        if (!previous || previous.id !== row.id) {
          return previous;
        }
        return mergeWorkItemRealtimeRow(previous, row, DUE_DATE_FIELDS);
      });
    },
    [setItemToEdit, setLocalWorkItems]
  );

  const dueDateQueue = useMemo(
    () =>
      createSerialCoalesceMutationQueue<string | null>({
        areEqual: (a, b) => a === b,
        getAckSeed: (id) => {
          const item = findItem(id);
          if (!item) {
            return undefined;
          }
          return dueDateDay(item.due_date);
        },
        getExpectedUpdatedAt: (id) => findItem(id)?.updated_at,
        applyOptimistic: (id, desired) => {
          syncWorkItemDueDate(id, desired);
        },
        reconcileToAck: (id, ack) => {
          syncWorkItemDueDate(id, ack);
        },
        onPendingChange: (id, isPending) => {
          setPendingDueDateIds((prev) => toggleIdInSet(prev, id, isPending));
        },
        onFlushError: (id, error) => {
          if (isBoardMoveOptimisticLockError(error)) {
            toastWorkItemDnDConflict(
              CALENDAR_CONFLICT_TITLE,
              CALENDAR_CONFLICT_DESCRIPTION
            );
            const serverRow = readBoardMoveConflictServerRow(error);
            if (serverRow && typeof serverRow.updated_at === 'string') {
              applyDueDateRow(serverRow, true);
              dueDateQueueRef.current.acknowledge(
                id,
                dueDateDay(serverRow.due_date),
                serverRow.updated_at
              );
            }
            return;
          }
          let message: string;
          if (error instanceof ApiError) {
            message = error.message;
          } else if (error instanceof Error) {
            message = error.message;
          } else {
            message = 'Failed to update work item due date.';
          }
          showDueDateWarning(message);
        },
        send: async (id, desired, expectedUpdatedAt, sendOptions) => {
          if (desired == null) {
            throw new Error('Cannot flush a null due date from calendar drag.');
          }
          const formData = new FormData();
          formData.set('due_date', desired);
          const response = await updateWorkItem(
            id,
            formData,
            expectedUpdatedAt,
            { keepalive: sendOptions?.keepalive === true }
          );
          if (response.error || !response.data) {
            throw new Error(
              typeof response.error === 'string'
                ? response.error
                : 'Failed to update work item due date.'
            );
          }
          const updated = response.data;
          const ack = dueDateDay(updated.due_date) ?? desired;
          syncWorkItemDueDate(id, ack, updated.updated_at);
          return { ack, expectedUpdatedAt: updated.updated_at };
        },
      }),
    [applyDueDateRow, findItem, showDueDateWarning, syncWorkItemDueDate]
  );
  const dueDateQueueRef = useRef(dueDateQueue);
  dueDateQueueRef.current = dueDateQueue;

  usePendingMutationUnload(dueDateQueue);

  useWorkItemsRealtime({
    enabled: Boolean(userId),
    channelPrefix: 'calendar-work-items',
    projectId: projectId || null,
    onRow: applyDueDateRow,
  });

  const applyDueDateChange = useCallback(
    (itemId: string, targetDate: string) => {
      const currentItem = findItem(itemId);
      if (!currentItem) {
        return;
      }

      if (currentItem.status === 'Done') {
        return;
      }

      const previousDateOnly = dueDateDay(currentItem.due_date);
      if (previousDateOnly === targetDate && !dueDateQueue.isPending(itemId)) {
        return;
      }

      if (targetDate < toLocalYYYYMMDD(new Date())) {
        showDueDateWarning(PAST_DUE_DATE_MESSAGE);
        return;
      }

      dueDateQueue.enqueue(itemId, targetDate);
    },
    [dueDateQueue, findItem, showDueDateWarning]
  );

  const handleItemDragStart = (event: DragEvent, itemId: string): void => {
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
    if (itemId) {
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
