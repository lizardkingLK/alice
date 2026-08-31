import {
  forceUpdateUser,
  toggleUserActive,
} from '@/app/users/_services/users.mutations.client';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';

/** Re-apply pending user fields after an optimistic-lock conflict resolution. */
export async function resolveUserOptimisticConflict(
  entityId: string,
  pendingFields: Record<string, unknown>,
  expectedUpdatedAt: string
): Promise<void> {
  if (pendingFields.active !== undefined) {
    await toggleUserActive(
      entityId,
      pendingFields.active as boolean,
      expectedUpdatedAt
    );
    return;
  }

  if (pendingFields.role !== undefined) {
    await forceUpdateUser(entityId, pendingFields, expectedUpdatedAt);
    return;
  }

  if (pendingFields.name !== undefined) {
    await apiFetch(`/api/profile`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: pendingFields.name,
        expectedUpdatedAt,
      }),
    });
    return;
  }

  if (pendingFields.profile_picture !== undefined) {
    throw new Error(
      'Profile picture conflicts must be resolved by uploading again.'
    );
  }

  throw new Error('Unsupported user conflict fields.');
}
