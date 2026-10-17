import { describe, expect, it, vi } from 'vitest';
import { OPTIMISTIC_LOCK_ERROR_CODE } from '@repo/types';
import { ApiError } from '@/lib/api/api-fetch.helper';
import {
  BOARD_MOVE_CONFLICT_TITLE,
  isBoardMoveOptimisticLockError,
  readBoardMoveConflictServerRow,
  toastBoardMoveConflict,
} from '@/app/board/_helpers/board-move-conflict-toast';

vi.mock('@repo/ui/components/ui/sonner', () => ({
  toast: { message: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

import { toast } from '@repo/ui/components/ui/sonner';

describe('board-move-conflict-toast', () => {
  it('toasts a message title for board lock conflicts', () => {
    toastBoardMoveConflict();
    expect(toast.message).toHaveBeenCalledWith(BOARD_MOVE_CONFLICT_TITLE, {
      description: 'The board was updated to the latest placement.',
    });
  });

  it('detects 409 / OPTIMISTIC_LOCK and reads serverEntity', () => {
    const error = new ApiError('Conflict', 409, {
      code: OPTIMISTIC_LOCK_ERROR_CODE,
      serverEntity: {
        id: 'wi-1',
        status: 'Done',
        board_column_id: 'done',
        updated_at: '2026-10-02T00:00:00.000Z',
      },
    });
    expect(isBoardMoveOptimisticLockError(error)).toBe(true);
    expect(readBoardMoveConflictServerRow(error)).toEqual({
      id: 'wi-1',
      status: 'Done',
      board_column_id: 'done',
      updated_at: '2026-10-02T00:00:00.000Z',
    });
  });
});
