import type { AttachmentWithUploader } from '@repo/types';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { asIso } from '@/lib/api/wire-date';

/** Align Express JSON (Prisma ISO dates) with the PostgREST attachment row. */
export function mapAttachmentApiRow(
  row: Record<string, unknown>
): AttachmentWithUploader {
  return {
    ...row,
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
    uploader: row.uploader ?? null,
  } as unknown as AttachmentWithUploader;
}

/**
 * Optional RSC read path via Express GET (`DATA_READS_VIA_API` toggle).
 * `GET /api/attachments?work_item_id=` responds with a bare array of active rows.
 */
export async function fetchWorkItemAttachmentsFromApi(
  workItemId: string
): Promise<AttachmentWithUploader[]> {
  const params = new URLSearchParams({ work_item_id: workItemId });
  const rows = await apiFetch<Record<string, unknown>[] | null>(
    `/api/attachments?${params.toString()}`
  );

  return (rows ?? []).map(mapAttachmentApiRow);
}
