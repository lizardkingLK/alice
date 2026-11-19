import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import type {
  CreateWorkLogResponse,
  WorkItemWorkLog,
  WorklogExcelImportResponse,
  WorklogExcelPreviewResponse,
} from '@repo/types';

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

export async function downloadWorklogExcelTemplate(): Promise<Blob> {
  return await apiFetch<Blob>(`${API}/template`, { responseType: 'blob' });
}

function worklogExcelFormData(workItemId: string, file: File): FormData {
  const body = new FormData();
  body.set('work_item_id', workItemId);
  body.set('file', file);
  return body;
}

export async function previewWorkItemWorkLogsExcel(
  workItemId: string,
  file: File
): Promise<WorklogExcelPreviewResponse> {
  return await apiFetch<WorklogExcelPreviewResponse>(`${API}/preview`, {
    method: 'POST',
    body: worklogExcelFormData(workItemId, file),
  });
}

export async function importWorkItemWorkLogsExcel(
  workItemId: string,
  file: File
): Promise<WorklogExcelImportResponse> {
  return await apiFetch<WorklogExcelImportResponse>(`${API}/import`, {
    method: 'POST',
    body: worklogExcelFormData(workItemId, file),
  });
}
