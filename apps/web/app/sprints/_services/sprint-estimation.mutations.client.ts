'use client';

import {
  sprintEstimationResponseSchema,
  type SprintEstimationResponse,
} from '@repo/types/api/v1';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { formatZodError } from '@/lib/zod/format-zod-error';

const SPRINT_ESTIMATION_FETCH_TIMEOUT_MS = 60_000;

export async function generateSprintEstimates(
  sprintId: string,
  signal?: AbortSignal
): Promise<SprintEstimationResponse> {
  const response = await apiFetch<{ data: unknown }>(
    `/api/v1/sprints/${encodeURIComponent(sprintId)}/estimates`,
    {
      method: 'POST',
      skipDatabaseBusyRetry: true,
      timeoutMs: SPRINT_ESTIMATION_FETCH_TIMEOUT_MS,
      ...(signal ? { signal } : {}),
    }
  );

  const parsed = sprintEstimationResponseSchema.safeParse(response.data);
  if (!parsed.success || parsed.data.sprintId !== sprintId) {
    throw new Error(
      parsed.success
        ? 'Invalid sprint estimation response: sprint id does not match the request'
        : `Invalid sprint estimation response: ${formatZodError(parsed.error)}`
    );
  }

  return parsed.data;
}
