import { toast } from '@repo/ui/components/ui/sonner';
import {
  runLockedMutation,
  type RunLockedMutationOptions,
} from '@/lib/optimistic-lock/run-locked-mutation';

export function mutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Await a 202 Accepted destructive mutation, toast the message, and surface
 * failures via `onError`.
 */
export async function runAcceptedDestructiveAction(options: {
  readonly mutate: () => Promise<{ readonly message: string }>;
  // eslint-disable-next-line no-unused-vars -- callback option bag
  readonly onError: (message: string) => void;
  readonly failureFallback: string;
}): Promise<boolean> {
  try {
    const accepted = await options.mutate();
    toast.success(accepted.message);
    return true;
  } catch (error) {
    options.onError(mutationErrorMessage(error, options.failureFallback));
    return false;
  }
}

/**
 * Locked soft-archive path that returns 202 Accepted: toast on success,
 * open conflict dialog via `handleMutationError`, otherwise `onError`.
 */
export async function runLockedAcceptedDestructiveAction(
  options: RunLockedMutationOptions<{ readonly message: string }> & {
    // eslint-disable-next-line no-unused-vars -- callback option bag
    readonly onError: (message: string) => void;
    readonly failureFallback: string;
  }
): Promise<boolean> {
  const result = await runLockedMutation(options);
  if (!result.ok) {
    if (!result.conflict) {
      options.onError(
        mutationErrorMessage(result.error, options.failureFallback)
      );
    }
    return false;
  }
  toast.success(result.data.message);
  return true;
}
