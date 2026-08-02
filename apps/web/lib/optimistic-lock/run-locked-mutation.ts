import type { OptimisticLockEntityType } from '@repo/types';
import { resolveCurrentUserId } from '@/lib/optimistic-lock/resolve-user-id';

/* eslint-disable no-unused-vars -- callback option bag types */
type HandleMutationError = (options: {
  readonly error: unknown;
  readonly entityType: OptimisticLockEntityType;
  readonly entityId: string;
  readonly userId: string;
  readonly baseUpdatedAt: string;
  readonly pendingFields: Record<string, unknown>;
}) => boolean;
/* eslint-enable no-unused-vars */

export type RunLockedMutationOptions<T> = {
  readonly mutate: () => Promise<T>;
  readonly handleMutationError: HandleMutationError;
  readonly entityType: OptimisticLockEntityType;
  readonly entityId: string;
  readonly expectedUpdatedAt: string;
  readonly pendingFields: Record<string, unknown>;
  readonly currentUserId?: string | null;
};

export type RunLockedMutationResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly conflict: true }
  | { readonly ok: false; readonly conflict: false; readonly error: unknown };

/**
 * Run a mutation that may return 409 OPTIMISTIC_LOCK. On conflict, opens the
 * global dialog via `handleMutationError` and returns `{ ok: false, conflict: true }`.
 */
export async function runLockedMutation<T>(
  options: RunLockedMutationOptions<T>
): Promise<RunLockedMutationResult<T>> {
  try {
    const data = await options.mutate();
    return { ok: true, data };
  } catch (error) {
    const handled = await tryHandleLockedMutationError({
      error,
      handleMutationError: options.handleMutationError,
      entityType: options.entityType,
      entityId: options.entityId,
      expectedUpdatedAt: options.expectedUpdatedAt,
      pendingFields: options.pendingFields,
      currentUserId: options.currentUserId,
    });
    if (handled) {
      return { ok: false, conflict: true };
    }
    return { ok: false, conflict: false, error };
  }
}

/** Convenience: return data, null on handled conflict, otherwise rethrow. */
export async function runLockedMutationOrThrow<T>(
  options: RunLockedMutationOptions<T>
): Promise<T | null> {
  const result = await runLockedMutation(options);
  if (result.ok) {
    return result.data;
  }
  if (result.conflict) {
    return null;
  }
  throw result.error;
}

/** Use in catch blocks when the mutation already threw. */
export async function tryHandleLockedMutationError(options: {
  readonly error: unknown;
  readonly handleMutationError: HandleMutationError;
  readonly entityType: OptimisticLockEntityType;
  readonly entityId: string;
  readonly expectedUpdatedAt: string;
  readonly pendingFields: Record<string, unknown>;
  readonly currentUserId?: string | null;
}): Promise<boolean> {
  const userId = await resolveCurrentUserId(options.currentUserId);
  if (!userId) {
    return false;
  }
  return options.handleMutationError({
    error: options.error,
    entityType: options.entityType,
    entityId: options.entityId,
    userId,
    baseUpdatedAt: options.expectedUpdatedAt,
    pendingFields: options.pendingFields,
  });
}

/**
 * Registry soft-delete / restore pattern: run a locked mutation, surface
 * non-conflict errors via `onError`, and call `onSuccess` when ok.
 */
export async function runRegistryLockedAction<T>(
  options: RunLockedMutationOptions<T> & {
    /* eslint-disable-next-line no-unused-vars -- callback option bag type */
    readonly onError: (message: string) => void;
    readonly failureFallback: string;
    readonly onSuccess?: () => void;
  }
): Promise<boolean> {
  const result = await runLockedMutation(options);
  if (!result.ok) {
    if (!result.conflict) {
      options.onError(
        result.error instanceof Error
          ? result.error.message
          : options.failureFallback
      );
    }
    return false;
  }
  options.onSuccess?.();
  return true;
}
