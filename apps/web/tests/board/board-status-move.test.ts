import { describe, expect, it, vi } from 'vitest';
import { OPTIMISTIC_LOCK_ERROR_CODE } from '@repo/types';
import { BOARD_MOVE_FORBIDDEN_CODE } from '@repo/types/api/v1';
import { ApiError } from '@/lib/api/api-fetch.helper';
import {
  handleBoardStatusMoveError,
  handleBoardStatusMoveResponse,
  statusUpdateFailureMessage,
} from '@/app/board/_helpers/board-status-move';
import { BOARD_MOVE_CONFLICT_TITLE } from '@/app/board/_helpers/board-move-conflict-toast';

vi.mock('@repo/ui/components/ui/sonner', () => ({
  toast: { message: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

import { toast } from '@repo/ui/components/ui/sonner';

describe('board-status-move', () => {
  it('formats failure messages', () => {
    expect(statusUpdateFailureMessage(new Error('boom'))).toBe('boom');
    expect(statusUpdateFailureMessage('nope')).toBe('nope');
    expect(statusUpdateFailureMessage(null)).toBe(
      'Failed to update work item status.'
    );
  });

  it('syncs on successful response and reverts on error payload', () => {
    const sync = vi.fn();
    const revert = vi.fn();
    const onFailure = vi.fn();
    const handlers = {
      sync,
      revert,
      applyConflictRow: vi.fn(),
      onFailure,
    };

    handleBoardStatusMoveResponse(
      { data: { id: 'wi-1' } as never, error: null },
      handlers
    );
    expect(sync).toHaveBeenCalled();

    handleBoardStatusMoveResponse({ data: null, error: 'failed' }, handlers);
    expect(revert).toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith('failed');
  });

  it('toasts conflict and applies server row on 409', () => {
    const applyConflictRow = vi.fn();
    const revert = vi.fn();
    handleBoardStatusMoveError(
      new ApiError('Conflict', 409, {
        code: OPTIMISTIC_LOCK_ERROR_CODE,
        serverEntity: { id: 'wi-1', status: 'Done' },
      }),
      { sourceColumnName: 'A', targetColumnName: 'B' },
      {
        revert,
        sync: vi.fn(),
        applyConflictRow,
        onFailure: vi.fn(),
      }
    );
    expect(toast.message).toHaveBeenCalledWith(
      BOARD_MOVE_CONFLICT_TITLE,
      expect.any(Object)
    );
    expect(applyConflictRow).toHaveBeenCalledWith({
      id: 'wi-1',
      status: 'Done',
    });
    expect(revert).not.toHaveBeenCalled();
  });

  it('reverts and toasts on board-move forbidden', () => {
    const revert = vi.fn();
    handleBoardStatusMoveError(
      new ApiError('Forbidden', 403, { code: BOARD_MOVE_FORBIDDEN_CODE }),
      { sourceColumnName: 'Development', targetColumnName: 'Code Review' },
      {
        revert,
        sync: vi.fn(),
        applyConflictRow: vi.fn(),
        onFailure: vi.fn(),
      }
    );
    expect(revert).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});
