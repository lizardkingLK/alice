import { apiFetch } from '@/lib/api/api-client';
import { createClient } from '@/lib/supabase/client';
import type {
  AttachmentSignedUrls,
  AttachmentUploadSession,
  UploadedAttachmentResult,
} from '@repo/types';

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
): Promise<UploadedAttachmentResult> {
  const supabase = createClient();
  const mimeType = file.type || 'application/octet-stream';

  const session = await apiFetch<AttachmentUploadSession>(
    `${API}/upload-session`,
    {
      method: 'POST',
      body: JSON.stringify({
        work_item_id: workItemId,
        file_name: file.name,
        content_type: mimeType,
        file_size: file.size,
      }),
    }
  );

  const { error } = await supabase.storage
    .from(session.upload.bucket)
    .uploadToSignedUrl(session.upload.path, session.upload.token, file, {
      contentType: mimeType,
    });

  if (error) {
    throw new Error(error.message);
  }

  return apiFetch<UploadedAttachmentResult>(`${API}/finalize`, {
    method: 'POST',
    body: JSON.stringify({
      work_item_id: workItemId,
      storage_path: session.upload.path,
      file_name: file.name,
      file_size: file.size,
      mime_type: mimeType,
    }),
  });
}

/** Soft-delete attachment (archives row + best-effort Storage remove). */
export async function deleteWorkItemAttachment(
  attachmentId: string,
  expectedUpdatedAt: string
): Promise<void> {
  await apiFetch<{ success: true }>(`${API}/${attachmentId}`, {
    method: 'DELETE',
    body: JSON.stringify({ expectedUpdatedAt }),
  });
}
