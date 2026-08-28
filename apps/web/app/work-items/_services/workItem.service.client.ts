import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { apiFetch } from '@/lib/api/api-client';
import { forceOptimisticPatch } from '@/lib/optimistic-lock/force-patch';
import { coerceLabelsFormField } from '@repo/types';
import { ResponseDTO } from '@repo/types/connection';

const workItemsPath = '/api/workItems';

function isTiptapDoc(value: unknown): value is { type: 'doc' } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === 'doc'
  );
}

function applyLabelsFormField(body: Record<string, unknown>): void {
  if (!('labels' in body)) {
    return;
  }
  body.labels = coerceLabelsFormField(body.labels);
}

function formDataToCreateBody(formData: FormData): Record<string, unknown> {
  const body: Record<string, unknown> = Object.fromEntries(formData.entries());

  // TipTap docs are submitted as JSON strings via FormData; persist as objects.
  if (typeof body.description === 'string') {
    const raw = body.description.trim();
    if (!raw) {
      delete body.description;
    } else {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isTiptapDoc(parsed)) {
          body.description = parsed;
        }
        // Non-doc JSON (null, arrays, unrelated objects) stays a plain string.
      } catch {
        // Keep plain-string descriptions for legacy callers.
      }
    }
  }

  applyLabelsFormField(body);

  return body;
}

export async function createWorkItem(
  formData: FormData
): Promise<ResponseDTO<DbWorkItem>> {
  return await apiFetch<ResponseDTO<DbWorkItem>>(workItemsPath, {
    method: 'POST',
    body: JSON.stringify(formDataToCreateBody(formData)),
  });
}

/** Parent picker options for create/edit forms (same project + allowed parent type). */
export async function listParentCandidateWorkItems(input: {
  projectId: string;
  parentType: string;
  excludeId?: string | null;
}): Promise<Array<{ id: string; title: string; type: string }>> {
  const params = new URLSearchParams({
    page: '1',
    limit: '100',
    projectId: input.projectId,
    type: input.parentType,
  });
  const result = await apiFetch<{
    workItems: Array<{ id: string; title: string; type: string }>;
  }>(`${workItemsPath}?${params.toString()}`);

  return (result.workItems ?? []).filter(
    (item) => !input.excludeId || item.id !== input.excludeId
  );
}

function formDataToPatchBody(
  formData: FormData,
  expectedUpdatedAt: string
): Record<string, unknown> {
  const body: Record<string, unknown> = Object.fromEntries(formData.entries());
  body.expectedUpdatedAt = expectedUpdatedAt;
  applyLabelsFormField(body);
  return body;
}

export async function updateWorkItem(
  id: string,
  formData: FormData,
  expectedUpdatedAt: string
): Promise<ResponseDTO<DbWorkItem>> {
  return await apiFetch<ResponseDTO<DbWorkItem>>(`${workItemsPath}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(formDataToPatchBody(formData, expectedUpdatedAt)),
  });
}

export async function updateWorkItemStatus(
  id: string,
  status: DbWorkItem['status'],
  expectedUpdatedAt: string
): Promise<ResponseDTO<DbWorkItem>> {
  return await apiFetch<ResponseDTO<DbWorkItem>>(`${workItemsPath}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, expectedUpdatedAt }),
  });
}

/** Force-apply pending fields after a user confirms Keep mine / merge. */
export async function forceUpdateWorkItemFields(
  id: string,
  pendingFields: Record<string, unknown>,
  expectedUpdatedAt: string
): Promise<ResponseDTO<DbWorkItem>> {
  return forceOptimisticPatch<ResponseDTO<DbWorkItem>>(
    apiFetch,
    `${workItemsPath}/${id}`,
    { pendingFields, expectedUpdatedAt, method: 'PATCH' }
  );
}

export async function countWorkItemDescendants(id: string): Promise<number> {
  const data = await apiFetch<{ descendantCount: number }>(
    `${workItemsPath}/${id}/descendant-count`
  );
  return data.descendantCount;
}

async function patchWorkItemLifecycle(
  id: string,
  action: 'archive' | 'restore',
  expectedUpdatedAt: string
): Promise<DbWorkItem> {
  const data = await apiFetch<{ workItem: DbWorkItem }>(
    `${workItemsPath}/${id}/${action}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ expectedUpdatedAt }),
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

export interface GithubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface LinkedGithubPR {
  id: string;
  pr_number: number;
  pr_title: string;
  pr_url: string;
  status: 'open' | 'merged' | 'closed';
  branch_name: string | null;
  commits: GithubCommit[];
}

export async function getLinkedPRs(
  workItemId: string
): Promise<{ prs: LinkedGithubPR[]; githubRepo: string | null }> {
  const res = await apiFetch<{
    prs: LinkedGithubPR[];
    githubRepo: string | null;
  }>(`${workItemsPath}/${workItemId}/github`);
  return { prs: res.prs || [], githubRepo: res.githubRepo || null };
}

export async function linkPR(
  workItemId: string,
  prUrl: string
): Promise<ResponseDTO<LinkedGithubPR>> {
  return await apiFetch<ResponseDTO<LinkedGithubPR>>(
    `${workItemsPath}/${workItemId}/github`,
    {
      method: 'POST',
      body: JSON.stringify({ prUrl }),
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
