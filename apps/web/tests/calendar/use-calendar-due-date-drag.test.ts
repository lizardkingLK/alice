import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DragEvent } from 'react';
import { ApiError } from '@/lib/api/api-fetch.helper';
import { PAST_DUE_DATE_MESSAGE } from '@/app/calendar/_components/calendar-utils';
import { useCalendarDueDateDrag } from '@/app/calendar/_components/use-calendar-due-date-drag';
import { workItemFactory } from '@/tests/factories/workItem.factory';

const updateWorkItemMock = vi.hoisted(() => vi.fn());
const handleMutationErrorMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('@/app/work-items/_services/work-items.mutations.client', () => ({
  updateWorkItem: updateWorkItemMock,
}));

vi.mock('@/components/optimistic-lock/optimistic-lock-provider', () => ({
  useOptimisticLock: () => ({
    handleMutationError: handleMutationErrorMock,
  }),
}));

function dropEvent(itemId: string): DragEvent {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      getData: vi.fn(() => itemId),
    },
  } as unknown as DragEvent;
}

function renderDueDateDrag(status: 'ToDo' | 'Done') {
  const item = workItemFactory.build({
    id: `item-${status}`,
    status,
    due_date: '2099-01-01',
  });
  const setLocalWorkItems = vi.fn();
  const setItemToEdit = vi.fn();

  return {
    item,
    setLocalWorkItems,
    setItemToEdit,
    ...renderHook(() =>
      useCalendarDueDateDrag({
        localWorkItems: [item],
        setLocalWorkItems,
        setItemToEdit,
        userId: 'user-1',
      })
    ),
  };
}

describe('useCalendarDueDateDrag warnings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleMutationErrorMock.mockReturnValue(false);
  });

  it('silently ignores due-date changes for Done work items', () => {
    const { item, result, setLocalWorkItems } = renderDueDateDrag('Done');

    act(() => {
      result.current.handleDayDrop(dropEvent(item.id), '2099-02-01');
    });

    expect(updateWorkItemMock).not.toHaveBeenCalled();
    expect(setLocalWorkItems).not.toHaveBeenCalled();
    expect(result.current.dueDateWarningOpen).toBe(false);
    expect(result.current.dueDateWarning).toBe('');
  });

  it('preserves the warning for drops onto past dates', () => {
    const { item, result } = renderDueDateDrag('ToDo');

    act(() => {
      result.current.handleDayDrop(dropEvent(item.id), '2000-01-01');
    });

    expect(updateWorkItemMock).not.toHaveBeenCalled();
    expect(result.current.dueDateWarningOpen).toBe(true);
    expect(result.current.dueDateWarning).toBe(PAST_DUE_DATE_MESSAGE);
  });

  it('preserves the warning for other due-date update errors', async () => {
    updateWorkItemMock.mockRejectedValueOnce(
      new ApiError('Unable to save the due date', 400)
    );
    const { item, result } = renderDueDateDrag('ToDo');

    act(() => {
      result.current.handleDayDrop(dropEvent(item.id), '2099-02-01');
    });

    await waitFor(() => {
      expect(result.current.dueDateWarningOpen).toBe(true);
    });
    expect(result.current.dueDateWarning).toBe('Unable to save the due date');
  });
});
