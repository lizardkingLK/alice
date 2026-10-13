import type { SprintBurndownPayload } from '@repo/types';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.client';

/**
 * Sprint burndown series. Prefers `sprint_burndown_rollups` on the API when
 * the migration is applied; otherwise live computeBurndown (worklogs / done_at).
 */
export async function fetchSprintBurndown(
  sprintId: string
): Promise<SprintBurndownPayload> {
  return apiFetch<SprintBurndownPayload>(`/api/sprints/${sprintId}/burndown`);
}
