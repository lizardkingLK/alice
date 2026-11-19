'use client';

import type { AccessRequestGrantInput } from '@repo/types';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import type { DestructiveActionAccepted } from './access-requests.mutations.shared';

export type { DestructiveActionAccepted };

export async function denyAccessRequestClient(
  requestId: string
): Promise<void> {
  await apiFetch<{ success: boolean }>(
    `/api/access-requests/${requestId}/deny`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );
}

export async function grantAccessRequestClient(
  requestId: string,
  input: AccessRequestGrantInput
): Promise<void> {
  await apiFetch<{ success: boolean }>(
    `/api/access-requests/${requestId}/grant`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export type SharedMembershipProject = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
};

export async function listSharedMembershipsClient(
  requestId: string
): Promise<SharedMembershipProject[]> {
  const data = await apiFetch<{ projects: SharedMembershipProject[] }>(
    `/api/access-requests/${requestId}/shared-memberships`
  );
  return data.projects ?? [];
}

/** Fire-and-forget purge — API returns 202; inbox notifies when done. */
export async function deleteAccessRequestClient(
  requestId: string
): Promise<DestructiveActionAccepted> {
  return await apiFetch<DestructiveActionAccepted>(
    `/api/access-requests/${requestId}`,
    {
      method: 'DELETE',
      skipDatabaseBusyRetry: true,
    }
  );
}
