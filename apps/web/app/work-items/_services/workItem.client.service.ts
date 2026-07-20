import { DbWorkItem } from '@/app/work-items/_services/workItem.server.service';
import { apiFetch } from '@/lib/api/api-client';
import { ResponseDTO } from '@repo/types/connection';

const workItemsPath = '/api/workItems';

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
  data: FormData | Record<string, unknown>
): Promise<ResponseDTO<DbWorkItem>> {
  const body =
    data instanceof FormData
      ? JSON.stringify(Object.fromEntries(data.entries()))
      : JSON.stringify(data);

  return await apiFetch<ResponseDTO<DbWorkItem>>(`${workItemsPath}/${id}`, {
    method: 'PATCH',
    body,
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
