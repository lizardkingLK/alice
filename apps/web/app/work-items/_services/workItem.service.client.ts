import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { apiFetch } from '@/lib/api/api-client';
import { forceOptimisticPatch } from '@/lib/optimistic-lock/force-patch';
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

function isTiptapDoc(value: unknown): value is { type: 'doc' } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === 'doc'
  );
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

function formDataToPatchBody(
  formData: FormData,
  expectedUpdatedAt: string
): Record<string, unknown> {
  const body: Record<string, unknown> = Object.fromEntries(formData.entries());
  body.expectedUpdatedAt = expectedUpdatedAt;
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
