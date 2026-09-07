import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatAttachmentFileTypeEnum } from '@repo/types';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/api-fetch.mutations.use.client', () => ({
  apiFetch: apiFetchMock,
}));

import {
  uploadChatAttachment,
  deleteChatAttachment,
} from '@/app/chat/_services/chat-attachments.client';

describe('chat-attachments.client', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  describe('uploadChatAttachment', () => {
    it('sends multipart FormData and returns the uploaded attachment wire', async () => {
      const mockAttachment = {
        id: 'att-123',
        fileName: 'data.json',
        fileSize: 1024,
        mimeType: 'application/json',
        storagePath: 'chat-attachments/att-123/data.json',
        url: 'https://supabase.co/storage/v1/object/sign/att-123/data.json',
        fileType: ChatAttachmentFileTypeEnum.Json,
      };

      apiFetchMock.mockResolvedValueOnce({
        success: true,
        attachment: mockAttachment,
      });

      const file = new File(['{"items":[]}'], 'data.json', {
        type: 'application/json',
      });
      const result = await uploadChatAttachment(file, 'conv-abc');

      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/v1/chat/attachments',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(result).toEqual(mockAttachment);
    });
  });

  describe('deleteChatAttachment', () => {
    it('sends DELETE request with attachment id', async () => {
      apiFetchMock.mockResolvedValueOnce({ success: true });

      await deleteChatAttachment('att-123');

      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/v1/chat/attachments/att-123',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });
});
