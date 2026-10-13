import { BOARD_MOVE_FORBIDDEN_CODE } from '@repo/types/api/v1';
import { toast } from '@repo/ui/components/ui/sonner';
import { ApiError } from '@/lib/api/api-fetch.helper';

export const WORKFLOW_MOVE_BLOCKED_TITLE = 'Move blocked';

/**
 * Strip a leading "Move blocked:" prefix so the remainder can be the toast
 * description under a fixed title.
 */
export function workflowMoveBlockedDescription(message: string): string {
  const trimmed = message.trim();
  const withoutPrefix = trimmed.replace(/^Move blocked:\s*/i, '').trim();
  return withoutPrefix || 'This move is not allowed.';
}

/** Title "Move blocked" + muted description (transition / auth / children). */
export function toastWorkflowMoveBlocked(message: string): void {
  toast.error(WORKFLOW_MOVE_BLOCKED_TITLE, {
    description: workflowMoveBlockedDescription(message),
  });
}

/** Auth (403 board-move) or validation (400) workflow transition failures. */
export function isWorkflowMoveBlockedError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  return error.code === BOARD_MOVE_FORBIDDEN_CODE || error.status === 400;
}

export function toastWorkflowMoveBlockedFromError(
  error: unknown,
  fallback = 'This move is not allowed.'
): void {
  const message =
    error instanceof Error && error.message.trim() ? error.message : fallback;
  toastWorkflowMoveBlocked(message);
}
