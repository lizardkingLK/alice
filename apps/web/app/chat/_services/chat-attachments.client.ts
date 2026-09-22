import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { createClient } from '@/lib/supabase/client';
import type {
  ChatAttachmentSignedUrls,
  ChatAttachmentUploadSession,
  ChatAttachmentWire,
  UploadedChatAttachmentResult,
} from '@repo/types';

const CHAT_API = '/api/v1/chat';

export interface ChatAttachmentUploadResult {
  readonly success: boolean;
  readonly attachment: ChatAttachmentWire;
}

export interface ChatAttachmentDeleteResult {
  readonly success: boolean;
}

/** Mint signed preview + download URLs for a chat attachment. */
export async function mintChatAttachmentUrls(
  attachmentId: string
): Promise<ChatAttachmentSignedUrls> {
  return apiFetch<ChatAttachmentSignedUrls>(
    `${CHAT_API}/attachments/${attachmentId}`
  );
}

/**
 * Upload a file directly to Supabase Storage via signed upload URL,
 * then finalize database registration.
 */
export async function uploadChatAttachment(
  file: File,
  conversationId?: string
): Promise<ChatAttachmentWire> {
  const supabase = createClient();
  const mimeType = file.type || 'application/octet-stream';

  const session = await apiFetch<ChatAttachmentUploadSession>(
    `${CHAT_API}/attachments/upload-session`,
    {
      method: 'POST',
      body: JSON.stringify({
        conversationId,
        fileName: file.name,
        contentType: mimeType,
        fileSize: file.size,
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

  const finalized = await apiFetch<UploadedChatAttachmentResult>(
    `${CHAT_API}/attachments/finalize`,
    {
      method: 'POST',
      body: JSON.stringify({
        conversationId,
        storagePath: session.upload.path,
        fileName: file.name,
        fileSize: file.size,
        mimeType,
      }),
    }
  );

  return finalized.attachment;
}

/** Soft-delete attachment (archives row + best-effort Storage remove). */
export async function deleteChatAttachment(
  attachmentId: string
): Promise<void> {
  await apiFetch<ChatAttachmentDeleteResult>(
    `${CHAT_API}/attachments/${attachmentId}`,
    {
      method: 'DELETE',
    }
  );
}
