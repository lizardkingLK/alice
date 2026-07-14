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
  formData: FormData
): Promise<ResponseDTO<DbWorkItem>> {
  return await apiFetch<ResponseDTO<DbWorkItem>>(`${workItemsPath}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(Object.fromEntries(formData.entries())),
  });
}
