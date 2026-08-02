import type { Sprint } from '@/app/sprints/_services/sprints.service';
import { updateSprintStatus } from '@/app/sprints/_services/sprints.service';
import {
  runLockedMutationOrThrow,
  type RunLockedMutationOptions,
} from '@/lib/optimistic-lock/run-locked-mutation';

/** PATCH sprint status with optimistic lock; null when a conflict dialog was opened. */
export async function updateSprintStatusWithOptimisticLock(options: {
  readonly sprint: Sprint;
  readonly status: Sprint['status'];
  readonly handleMutationError: RunLockedMutationOptions<Sprint>['handleMutationError'];
  readonly currentUserId?: string | null;
}): Promise<Sprint | null> {
  const { sprint, status, handleMutationError, currentUserId } = options;
  const expectedUpdatedAt = sprint.updatedAt;

  return runLockedMutationOrThrow({
    mutate: () => updateSprintStatus(sprint.id, status, expectedUpdatedAt),
    handleMutationError,
    entityType: 'sprint',
    entityId: sprint.id,
    expectedUpdatedAt,
    pendingFields: { status },
    currentUserId,
  });
}
