import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import type { CreateWorkLogResponse, WorkItemWorkLog } from '@repo/types';

const API = '/api/worklogs';

export type { WorkItemWorkLog };

export async function createWorkItemWorkLog(
  workItemId: string,
  input: {
    loggedHours: number;
    loggedAt?: string;
    comment?: string | null;
  }
): Promise<WorkItemWorkLog> {
  const data = await apiFetch<CreateWorkLogResponse>(API, {
    method: 'POST',
    body: JSON.stringify({
      work_item_id: workItemId,
      logged_hours: input.loggedHours,
      logged_at: input.loggedAt,
      comment: input.comment ?? null,
    }),
  });

  return data.worklog;
}
