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
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { ApiError } from '@/lib/api/api-fetch.helper';
import { runLockedMutation } from '@/lib/optimistic-lock/run-locked-mutation';
import {
  PAST_DUE_DATE_MESSAGE,
  toLocalYYYYMMDD,
} from '@/app/calendar/_components/calendar-utils';

type UseCalendarDueDateDragOptions = {
  readonly localWorkItems: DbWorkItem[];
  readonly setLocalWorkItems: Dispatch<SetStateAction<DbWorkItem[]>>;
  readonly setItemToEdit: Dispatch<SetStateAction<DbWorkItem | null>>;
  readonly userId: string | null;
};

export function useCalendarDueDateDrag({
  localWorkItems,
  setLocalWorkItems,
  setItemToEdit,
  userId,
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
  const { handleMutationError } = useOptimisticLock();

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
      setLocalWorkItems((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                due_date: dueDate,
                ...(updatedAt ? { updated_at: updatedAt } : {}),
              }
            : item
        )
      );
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

  const applyDueDateChange = useCallback(
    (itemId: string, targetDate: string) => {
      const currentItem = localWorkItems.find((item) => item.id === itemId);
      if (!currentItem || pendingDueDateIds.has(itemId)) {
        return;
      }

      const previousDueDate = currentItem.due_date;
      const previousDateOnly = previousDueDate?.split('T')[0] ?? null;
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

      runLockedMutation({
        mutate: () => updateWorkItem(itemId, formData, expectedUpdatedAt),
        handleMutationError,
        entityType: 'work_item',
        entityId: itemId,
        expectedUpdatedAt,
        pendingFields: { due_date: targetDate },
        currentUserId: userId,
      })
        .then((result) => {
          if (result.ok) {
            const updated = result.data.data;
            if (updated?.updated_at) {
              syncWorkItemDueDate(
                itemId,
                updated.due_date?.split('T')[0] ?? targetDate,
                updated.updated_at
              );
            }
            return;
          }

          if (result.conflict) {
            return;
          }

          syncWorkItemDueDate(itemId, previousDueDate);
          let message: string;
          if (result.error instanceof ApiError) {
            message = result.error.message;
          } else if (result.error instanceof Error) {
            message = result.error.message;
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
      handleMutationError,
      localWorkItems,
      pendingDueDateIds,
      showDueDateWarning,
      syncWorkItemDueDate,
      userId,
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
