import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { apiFetch } from '@/lib/api/api-client';
import type { WorkItemWorkLog } from '@repo/types';
import { ResponseDTO } from '@repo/types/connection';

const workItemsPath = '/api/workItems';

export type { WorkItemWorkLog };

export async function createWorkItemWorkLog(
  workItemId: string,
  input: {
    loggedHours: number;
    loggedAt?: string; // YYYY-MM-DD
    comment?: string | null;
  }
): Promise<WorkItemWorkLog> {
  const data = await apiFetch<{ worklog: WorkItemWorkLog }>(
    `${workItemsPath}/${workItemId}/worklogs`,
    {
      method: 'POST',
      body: JSON.stringify({
        logged_hours: input.loggedHours,
        logged_at: input.loggedAt,
        comment: input.comment ?? null,
      }),
    }
  );

  return data.worklog;
}

export async function createWorkItem(
  formData: FormData
): Promise<ResponseDTO<DbWorkItem>> {
  return await apiFetch<ResponseDTO<DbWorkItem>>(workItemsPath, {
    method: 'POST',
    body: JSON.stringify(Object.fromEntries(formData.entries())),
  });
}

export async function updateWorkItem(
  id: string,
  formData: FormData
): Promise<ResponseDTO<DbWorkItem>> {
  return await apiFetch<ResponseDTO<DbWorkItem>>(`${workItemsPath}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(Object.fromEntries(formData.entries())),
  });
}

export async function updateWorkItemStatus(
  id: string,
  status: DbWorkItem['status']
): Promise<ResponseDTO<DbWorkItem>> {
  return await apiFetch<ResponseDTO<DbWorkItem>>(`${workItemsPath}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
