import { describe, expect, it, vi } from 'vitest';
import { BOARD_MOVE_FORBIDDEN_CODE } from '@repo/types/api/v1';
import { ApiError } from '@/lib/api/api-fetch.helper';
import {
  WORKFLOW_MOVE_BLOCKED_TITLE,
  isWorkflowMoveBlockedError,
  toastWorkflowMoveBlocked,
  workflowMoveBlockedDescription,
} from '@/app/board/_helpers/workflow-move-blocked-toast';

vi.mock('@repo/ui/components/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from '@repo/ui/components/ui/sonner';

describe('workflow-move-blocked-toast', () => {
  it('strips a Move blocked prefix for the description', () => {
    expect(
      workflowMoveBlockedDescription(
        'Move blocked: This transition is not allowed in the workflow (Working → ToDo).'
      )
    ).toBe('This transition is not allowed in the workflow (Working → ToDo).');
  });

  it('toasts with title and description', () => {
    toastWorkflowMoveBlocked(
      'Cannot move while 2 subtasks are not in the target state. Align children first.'
    );
    expect(toast.error).toHaveBeenCalledWith(WORKFLOW_MOVE_BLOCKED_TITLE, {
      description:
        'Cannot move while 2 subtasks are not in the target state. Align children first.',
    });
  });

  it('detects board-move forbidden and 400 ApiErrors', () => {
    expect(
      isWorkflowMoveBlockedError(
        new ApiError('Forbidden', 403, { code: BOARD_MOVE_FORBIDDEN_CODE })
      )
    ).toBe(true);
    expect(
      isWorkflowMoveBlockedError(
        new ApiError('This transition is not allowed in the workflow.', 400)
      )
    ).toBe(true);
    expect(isWorkflowMoveBlockedError(new Error('nope'))).toBe(false);
  });
});
