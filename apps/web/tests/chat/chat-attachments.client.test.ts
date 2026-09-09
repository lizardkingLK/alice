import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatAttachmentFileTypeEnum } from '@repo/types';

const apiFetchMock = vi.hoisted(() => vi.fn());
const uploadToSignedUrlMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/api-fetch.mutations.use.client', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: vi.fn(() => ({
        uploadToSignedUrl: uploadToSignedUrlMock,
      })),
    },
  }),
}));

import {
  uploadChatAttachment,
  deleteChatAttachment,
  mintChatAttachmentUrls,
} from '@/app/chat/_services/chat-attachments.client';

describe('chat-attachments.client', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    uploadToSignedUrlMock.mockReset();
  });

  describe('uploadChatAttachment', () => {
    it('creates upload session, uploads to signed URL, and finalizes attachment', async () => {
      const mockSession = {
        upload: {
          bucket: 'alice_storage_chat_attachments',
          signedUrl: 'https://supabase.co/signed-upload',
          token: 'signed-token-123',
          path: 'chat-attachments/user-1/data.json',
        },
      };

      const mockAttachment = {
        id: 'att-123',
        fileName: 'data.json',
        fileSize: 1024,
        mimeType: 'application/json',
        storagePath: 'chat-attachments/user-1/data.json',
        url: 'https://supabase.co/storage/v1/object/sign/att-123/data.json',
        fileType: ChatAttachmentFileTypeEnum.Json,
      };

      apiFetchMock.mockResolvedValueOnce(mockSession).mockResolvedValueOnce({
        success: true,
        attachment: mockAttachment,
      });

      uploadToSignedUrlMock.mockResolvedValueOnce({ error: null });

      const file = new File(['{"items":[]}'], 'data.json', {
        type: 'application/json',
      });
      const result = await uploadChatAttachment(file, 'conv-abc');

      expect(apiFetchMock).toHaveBeenNthCalledWith(
        1,
        '/api/v1/chat/attachments/upload-session',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            conversationId: 'conv-abc',
            fileName: 'data.json',
            contentType: 'application/json',
            fileSize: file.size,
          }),
        })
      );

      expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
        'chat-attachments/user-1/data.json',
        'signed-token-123',
        file,
        { contentType: 'application/json' }
      );

      expect(apiFetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/v1/chat/attachments/finalize',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            conversationId: 'conv-abc',
            storagePath: 'chat-attachments/user-1/data.json',
            fileName: 'data.json',
            fileSize: file.size,
            mimeType: 'application/json',
          }),
        })
      );

      expect(result).toEqual(mockAttachment);
    });

    it('throws error when uploadToSignedUrl fails', async () => {
      const mockSession = {
        upload: {
          bucket: 'alice_storage_chat_attachments',
          signedUrl: 'https://supabase.co/signed-upload',
          token: 'signed-token-123',
          path: 'chat-attachments/user-1/data.json',
        },
      };

      apiFetchMock.mockResolvedValueOnce(mockSession);
      uploadToSignedUrlMock.mockResolvedValueOnce({
        error: new Error('Upload to storage failed'),
      });

      const file = new File(['{"items":[]}'], 'data.json', {
        type: 'application/json',
      });

      await expect(uploadChatAttachment(file)).rejects.toThrow(
        'Upload to storage failed'
      );
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

  describe('mintChatAttachmentUrls', () => {
    it('fetches signed URLs for attachment', async () => {
      const mockSignedUrls = {
        previewUrl: 'https://supabase.co/preview',
        downloadUrl: 'https://supabase.co/download',
        expiresAt: '2026-09-08T12:00:00.000Z',
      };
      apiFetchMock.mockResolvedValueOnce(mockSignedUrls);

      const urls = await mintChatAttachmentUrls('att-123');
      expect(urls).toEqual(mockSignedUrls);
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/v1/chat/attachments/att-123'
      );
    });
  });
});
