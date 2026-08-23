import type { LockedImageUploadOutcome } from '@/lib/image-position/upload-locked-image';

type ApplyLockedImageUploadHandlers<TResult> = {
  // eslint-disable-next-line no-unused-vars -- callback option bag
  readonly onSuccess: (result: TResult) => void;
  // eslint-disable-next-line no-unused-vars -- callback option bag
  readonly onFailure: (message: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback option bag
  readonly onConflictUpdatedAt?: (updatedAt: string) => void;
};

/**
 * Shared success / conflict / error branching for `uploadLockedImage` outcomes.
 * Returns whether the upload succeeded.
 */
export function applyLockedImageUploadOutcome<TResult>(
  outcome: LockedImageUploadOutcome<TResult>,
  handlers: ApplyLockedImageUploadHandlers<TResult>
): boolean {
  if (outcome.kind === 'success') {
    handlers.onSuccess(outcome.result);
    return true;
  }

  if (
    outcome.kind === 'conflict' &&
    outcome.updatedAt &&
    handlers.onConflictUpdatedAt
  ) {
    handlers.onConflictUpdatedAt(outcome.updatedAt);
  }

  handlers.onFailure(outcome.message);
  return false;
}
