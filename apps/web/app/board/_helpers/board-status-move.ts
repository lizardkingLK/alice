import { BOARD_MOVE_FORBIDDEN_CODE } from '@repo/types/api/v1';
import type { ResponseDTO } from '@repo/types/connection';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { ApiError } from '@/lib/api/api-fetch.helper';
import {
  isBoardMoveOptimisticLockError,
  readBoardMoveConflictServerRow,
  toastBoardMoveConflict,
} from '@/app/board/_helpers/board-move-conflict-toast';
import { toastWorkflowMoveBlocked } from '@/app/board/_helpers/workflow-move-blocked-toast';

export function statusUpdateFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return 'Failed to update work item status.';
}

type BoardPlacementRow = Partial<DbWorkItem> & { id: string };

type BoardStatusMoveHandlers = {
  readonly revert: () => void;
  /* eslint-disable no-unused-vars -- handler callbacks */
  readonly sync: (updated: DbWorkItem) => void;
  readonly applyConflictRow: (row: BoardPlacementRow) => void;
  readonly onFailure: (message: string) => void;
  /* eslint-enable no-unused-vars */
};

export function handleBoardStatusMoveResponse(
  response: ResponseDTO<DbWorkItem>,
  handlers: BoardStatusMoveHandlers
): void {
  if (response.error || !response.data) {
    handlers.revert();
    handlers.onFailure(
      typeof response.error === 'string'
        ? response.error
        : 'Failed to update work item status.'
    );
    return;
  }
  handlers.sync(response.data);
}

export function handleBoardStatusMoveError(
  error: unknown,
  context: {
    readonly sourceColumnName: string;
    readonly targetColumnName: string;
  },
  handlers: BoardStatusMoveHandlers
): void {
  if (error instanceof ApiError && error.code === BOARD_MOVE_FORBIDDEN_CODE) {
    handlers.revert();
    toastWorkflowMoveBlocked(
      `You do not have permission to move this item from ${context.sourceColumnName} to ${context.targetColumnName}.`
    );
    return;
  }
  if (error instanceof ApiError && error.status === 400) {
    handlers.revert();
    toastWorkflowMoveBlocked(error.message);
    return;
  }
  if (isBoardMoveOptimisticLockError(error)) {
    toastBoardMoveConflict();
    const serverRow = readBoardMoveConflictServerRow(error);
    if (serverRow) {
      handlers.applyConflictRow(serverRow);
    }
    return;
  }
  handlers.revert();
  handlers.onFailure(statusUpdateFailureMessage(error));
}
