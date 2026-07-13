import { DbWorkItem } from '@/app/work-items/_services/workItem.server.service';
import { apiFetch } from '@/lib/api/api-client';

const workItemsPath = '/api/workItems';

export type WorkItemModificationResponse = {
  data: DbWorkItem | null;
  error: unknown;
};

export async function createWorkItem(
  formData: FormData
): Promise<WorkItemModificationResponse> {
  return await apiFetch<WorkItemModificationResponse>(workItemsPath, {
    method: 'POST',
    body: JSON.stringify(Object.fromEntries(formData.entries())),
  });
}

export async function updateWorkItem(
  id: string,
  formData: FormData
): Promise<WorkItemModificationResponse> {
  return await apiFetch<WorkItemModificationResponse>(
    `${workItemsPath}/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    }
  );
}
