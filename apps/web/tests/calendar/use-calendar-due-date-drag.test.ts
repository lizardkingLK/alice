import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DragEvent } from 'react';
import { OPTIMISTIC_LOCK_ERROR_CODE } from '@repo/types';
import { ApiError } from '@/lib/api/api-fetch.helper';
import { PAST_DUE_DATE_MESSAGE } from '@/app/calendar/_components/calendar-utils';
import { useCalendarDueDateDrag } from '@/app/calendar/_components/use-calendar-due-date-drag';
import { workItemFactory } from '@/tests/factories/workItem.factory';

const updateWorkItemMock = vi.hoisted(() => vi.fn());
const toastMessageMock = vi.hoisted(() => vi.fn());
const removeChannelMock = vi.hoisted(() => vi.fn());
const subscribeMock = vi.hoisted(() => vi.fn());
const onMock = vi.hoisted(() => vi.fn());
const channelMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/work-items/_services/work-items.mutations.client', () => ({
  updateWorkItem: updateWorkItemMock,
}));

vi.mock('@repo/ui/components/ui/sonner', () => ({
  toast: { message: toastMessageMock, error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: channelMock,
    removeChannel: removeChannelMock,
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
    updated_at: '2026-10-01T00:00:00.000Z',
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

describe('useCalendarDueDateDrag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onMock.mockReturnValue({ subscribe: subscribeMock });
    channelMock.mockReturnValue({ on: onMock });
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

  it('syncs updated_at after a successful due-date PATCH', async () => {
    updateWorkItemMock.mockResolvedValueOnce({
      data: {
        id: 'item-ToDo',
        due_date: '2099-02-01',
        updated_at: '2026-10-02T00:00:00.000Z',
      },
      error: null,
    });
    const { item, result, setLocalWorkItems } = renderDueDateDrag('ToDo');

    act(() => {
      result.current.handleDayDrop(dropEvent(item.id), '2099-02-01');
    });

    await waitFor(() => {
      expect(updateWorkItemMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(setLocalWorkItems).toHaveBeenCalled();
    });
    const lastCall = setLocalWorkItems.mock.calls.at(-1)?.[0];
    expect(typeof lastCall).toBe('function');
    const next = lastCall([item]);
    expect(next[0]?.due_date).toBe('2099-02-01');
    expect(next[0]?.updated_at).toBe('2026-10-02T00:00:00.000Z');
  });

  it('toasts and rebases on optimistic-lock 409', async () => {
    updateWorkItemMock.mockRejectedValueOnce(
      new ApiError('Conflict', 409, {
        code: OPTIMISTIC_LOCK_ERROR_CODE,
        serverEntity: {
          id: 'item-ToDo',
          due_date: '2099-03-15',
          updated_at: '2026-10-03T00:00:00.000Z',
        },
      })
    );
    const { item, result, setLocalWorkItems } = renderDueDateDrag('ToDo');

    act(() => {
      result.current.handleDayDrop(dropEvent(item.id), '2099-02-01');
    });

    await waitFor(() => {
      expect(toastMessageMock).toHaveBeenCalled();
    });
    expect(toastMessageMock).toHaveBeenCalledWith(
      'Someone else updated this item',
      expect.objectContaining({
        description: 'The calendar was updated to the latest due date.',
      })
    );
    await waitFor(() => {
      expect(setLocalWorkItems).toHaveBeenCalled();
    });
    const updater = setLocalWorkItems.mock.calls.at(-1)?.[0];
    const next = updater([item]);
    expect(next[0]?.due_date).toBe('2099-03-15');
  });
});
