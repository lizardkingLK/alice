import { apiFetch } from '@/lib/api/api-client';
import type { AttachmentWithUploader } from '@repo/types';

export type AttachmentSignedUrls = {
  previewUrl: string;
  downloadUrl: string;
  expiresAt: string;
};

export type UploadAttachmentResult = {
  success: true;
  path: string;
  url: string;
  attachment?: AttachmentWithUploader;
};

const API = '/api/attachments';

/** Mint (or re-mint) signed preview + download URLs for an attachment. */
export async function mintAttachmentUrls(
  attachmentId: string
): Promise<AttachmentSignedUrls> {
  return apiFetch<AttachmentSignedUrls>(`${API}/${attachmentId}`);
}

/** Upload a file and optionally link it to a work item (DB row). */
export async function uploadWorkItemAttachment(
  file: File,
  workItemId: string
): Promise<UploadAttachmentResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('work_item_id', workItemId);

  return apiFetch<UploadAttachmentResult>(API, {
    method: 'POST',
    body: formData,
  });
}

/** Soft-delete attachment (archives row + best-effort Storage remove). */
export async function deleteWorkItemAttachment(
  attachmentId: string
): Promise<void> {
  await apiFetch<{ success: true }>(`${API}/${attachmentId}`, {
    method: 'DELETE',
  });
}
