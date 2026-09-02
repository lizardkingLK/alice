'use client';

import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';

export async function denyAccessRequestClient(
  requestId: string
): Promise<void> {
  await apiFetch<{ success: boolean }>(
    `/api/accessRequests/${requestId}/deny`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );
}
