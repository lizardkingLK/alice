import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import type { ChatAttachmentWire } from '@repo/types';

export interface ChatAttachmentUploadResult {
  readonly success: boolean;
  readonly attachment: ChatAttachmentWire;
}

export interface ChatAttachmentDeleteResult {
  readonly success: boolean;
}

export async function uploadChatAttachment(
  file: File,
  conversationId?: string
): Promise<ChatAttachmentWire> {
  const formData = new FormData();
  formData.append('file', file);
  if (conversationId) {
    formData.append('conversationId', conversationId);
  }

  const response = await apiFetch<ChatAttachmentUploadResult>(
    '/api/v1/chat/attachments',
    {
      method: 'POST',
      body: formData,
    }
  );

  return response.attachment;
}

export async function deleteChatAttachment(
  attachmentId: string
): Promise<void> {
  await apiFetch<ChatAttachmentDeleteResult>(
    `/api/v1/chat/attachments/${attachmentId}`,
    {
      method: 'DELETE',
    }
  );
}
