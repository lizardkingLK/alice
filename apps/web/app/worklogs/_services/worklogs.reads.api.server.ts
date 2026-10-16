import {
  normalizeWorkLogRow,
  type WorkItemWorkLog,
  type WorkItemWorkLogRowRaw,
} from '@repo/types';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { asIso } from '@/lib/api/wire-date';

/** Align Express JSON (Prisma ISO dates) with the PostgREST work-log row. */
export function mapWorkLogApiRow(
  row: Record<string, unknown>
): WorkItemWorkLog {
  return normalizeWorkLogRow({
    ...row,
    logged_at: asIso(row.logged_at),
  } as unknown as WorkItemWorkLogRowRaw);
}

/**
 * Optional RSC read path via Express GET (`DATA_READS_VIA_API` toggle).
 * `GET /api/worklogs?work_item_id=` responds with a bare array of active rows.
 */
export async function getWorkItemWorkLogsFromApi(
  workItemId: string
): Promise<WorkItemWorkLog[]> {
  const params = new URLSearchParams({ work_item_id: workItemId });
  const rows = await apiFetch<Record<string, unknown>[] | null>(
    `/api/worklogs?${params.toString()}`
  );

  return (rows ?? []).map(mapWorkLogApiRow);
}
