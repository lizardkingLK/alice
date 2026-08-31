import { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import type { LinkedGithubPR } from '@/app/work-items/_services/work-items.reads.client';
import {
  formatWorkItemZodError,
  parseCreateWorkItemFormData,
  parseForcePatchWorkItemBody,
  parsePatchWorkItemFormData,
} from '@/app/work-items/_helpers/work-item-mutation-body';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import {
  linkWorkItemGithubPrBodySchema,
  patchWorkItemStatusBodySchema,
  workItemLifecycleActionBodySchema,
  type PatchWorkItemStatusBody,
  type WorkItemLifecycleActionBody,
} from '@repo/types/api/v1';
import { ResponseDTO } from '@repo/types/connection';

const workItemsPath = '/api/workItems';

export async function createWorkItem(
  formData: FormData
): Promise<ResponseDTO<DbWorkItem>> {
  const body = parseCreateWorkItemFormData(formData);
  return await apiFetch<ResponseDTO<DbWorkItem>>(workItemsPath, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateWorkItem(
  id: string,
  formData: FormData,
  expectedUpdatedAt: string
): Promise<ResponseDTO<DbWorkItem>> {
  const body = parsePatchWorkItemFormData(formData, expectedUpdatedAt);
  return await apiFetch<ResponseDTO<DbWorkItem>>(`${workItemsPath}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function updateWorkItemStatus(
  id: string,
  status: DbWorkItem['status'],
  expectedUpdatedAt: string
): Promise<ResponseDTO<DbWorkItem>> {
  const body: PatchWorkItemStatusBody = { status, expectedUpdatedAt };
  const parsed = patchWorkItemStatusBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error('Invalid work item status update');
  }

  return await apiFetch<ResponseDTO<DbWorkItem>>(`${workItemsPath}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
}

/** Force-apply pending fields after a user confirms Keep mine / merge. */
export async function forceUpdateWorkItemFields(
  id: string,
  pendingFields: Record<string, unknown>,
  expectedUpdatedAt: string
): Promise<ResponseDTO<DbWorkItem>> {
  const body = parseForcePatchWorkItemBody(pendingFields, expectedUpdatedAt);
  return await apiFetch<ResponseDTO<DbWorkItem>>(`${workItemsPath}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

async function patchWorkItemLifecycle(
  id: string,
  action: 'archive' | 'restore',
  expectedUpdatedAt: string
): Promise<DbWorkItem> {
  const body: WorkItemLifecycleActionBody = { expectedUpdatedAt };
  const parsed = workItemLifecycleActionBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`Invalid work item ${action} request`);
  }

  const data = await apiFetch<{ workItem: DbWorkItem }>(
    `${workItemsPath}/${id}/${action}`,
    {
      method: 'PATCH',
      body: JSON.stringify(parsed.data),
    }
  );
  return data.workItem;
}

export async function archiveWorkItem(
  id: string,
  expectedUpdatedAt: string
): Promise<DbWorkItem> {
  return patchWorkItemLifecycle(id, 'archive', expectedUpdatedAt);
}

export async function restoreWorkItem(
  id: string,
  expectedUpdatedAt: string
): Promise<DbWorkItem> {
  return patchWorkItemLifecycle(id, 'restore', expectedUpdatedAt);
}

export async function purgeWorkItem(id: string): Promise<void> {
  await apiFetch<void>(`${workItemsPath}/${id}`, {
    method: 'DELETE',
  });
}

export async function linkPR(
  workItemId: string,
  prUrl: string
): Promise<ResponseDTO<LinkedGithubPR>> {
  const parsed = linkWorkItemGithubPrBodySchema.safeParse({ prUrl });
  if (!parsed.success) {
    throw new Error(formatWorkItemZodError(parsed.error));
  }

  return await apiFetch<ResponseDTO<LinkedGithubPR>>(
    `${workItemsPath}/${workItemId}/github`,
    {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    }
  );
}

export async function unlinkPR(
  workItemId: string,
  prId: string
): Promise<void> {
  await apiFetch<void>(`${workItemsPath}/${workItemId}/github/${prId}`, {
    method: 'DELETE',
  });
}
