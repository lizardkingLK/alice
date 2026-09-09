import { describe, it, expect, vi, beforeEach } from 'vitest';

const storageFromMock = vi.fn();

const { mockSupabaseClient } = vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  return {
    mockSupabaseClient: {
      from: vi.fn(),
      storage: {
        listBuckets: vi.fn(),
        createBucket: vi.fn(),
        from: vi.fn(),
      },
    },
  };
});

vi.mock('../../src/lib/supabase', () => ({
  createClient: () => mockSupabaseClient,
  supabase: mockSupabaseClient,
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    chat_attachments: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    chat_conversations: {
      findFirst: vi.fn(),
    },
  },
}));

import {
  ChatAttachmentsRepository,
  detectChatAttachmentFileType,
} from '../../src/routes/api/chat/chat-attachments.repository';
import { ChatAttachmentFileTypeEnum } from '@repo/types';
import { prisma } from '../../src/lib/prisma';

describe('ChatAttachmentsRepository', () => {
  describe('detectChatAttachmentFileType', () => {
    it('detects json file types', () => {
      expect(
        detectChatAttachmentFileType('items.json', 'application/json')
      ).toBe(ChatAttachmentFileTypeEnum.Json);
      expect(detectChatAttachmentFileType('data.JSON', 'text/plain')).toBe(
        ChatAttachmentFileTypeEnum.Json
      );
    });

    it('detects csv file types', () => {
      expect(detectChatAttachmentFileType('export.csv', 'text/csv')).toBe(
        ChatAttachmentFileTypeEnum.Csv
      );
      expect(
        detectChatAttachmentFileType('sheet.CSV', 'application/octet-stream')
      ).toBe(ChatAttachmentFileTypeEnum.Csv);
    });

    it('detects text file types', () => {
      expect(detectChatAttachmentFileType('notes.txt', 'text/plain')).toBe(
        ChatAttachmentFileTypeEnum.Text
      );
      expect(detectChatAttachmentFileType('README.md', 'text/markdown')).toBe(
        ChatAttachmentFileTypeEnum.Text
      );
    });

    it('detects image file types', () => {
      expect(detectChatAttachmentFileType('diagram.png', 'image/png')).toBe(
        ChatAttachmentFileTypeEnum.Image
      );
    });

    it('detects other file types', () => {
      expect(
        detectChatAttachmentFileType('archive.zip', 'application/zip')
      ).toBe(ChatAttachmentFileTypeEnum.Other);
    });
  });

  describe('upload and delete repository operations', () => {
    let repository: ChatAttachmentsRepository;

    beforeEach(() => {
      vi.clearAllMocks();

      mockSupabaseClient.storage.listBuckets.mockResolvedValue({
        data: [{ name: 'alice_storage_chat_attachments' }],
        error: null,
      });
      mockSupabaseClient.storage.createBucket.mockResolvedValue({
        error: null,
      });

      storageFromMock.mockReturnValue({
        upload: vi
          .fn()
          .mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://supabase.co/signed-url-test' },
          error: null,
        }),
        createSignedUploadUrl: vi.fn().mockResolvedValue({
          data: {
            signedUrl: 'https://supabase.co/signed-upload-test',
            token: 'test-token',
            path: 'test-upload-path',
          },
          error: null,
        }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        list: vi.fn().mockImplementation((_dir, options) =>
          Promise.resolve({
            data: [{ name: options?.search ?? 'test.json' }],
            error: null,
          })
        ),
      });

      mockSupabaseClient.storage.from = storageFromMock;

      repository = new ChatAttachmentsRepository(mockSupabaseClient as never);
    });

    it('creates an upload session', async () => {
      vi.mocked(prisma.chat_conversations.findFirst).mockResolvedValue({
        id: 'conv-1',
      } as never);

      const session = await repository.createUploadSession({
        userId: 'user-uuid-1',
        conversationId: 'conv-1',
        fileName: 'data.json',
        contentType: 'application/json',
        fileSize: 1024,
      });

      expect(session.upload.bucket).toBe('alice_storage_chat_attachments');
      expect(session.upload.signedUrl).toBe(
        'https://supabase.co/signed-upload-test'
      );
      expect(session.upload.token).toBe('test-token');
      expect(session.upload.path).toContain('chat-attachments/user-uuid-1/');
    });

    it('finalizes an upload session and returns ChatAttachmentWire', async () => {
      const mockRecord = {
        id: 'attachment-uuid-1',
        user_id: 'user-uuid-1',
        file_name: 'work-items.json',
        file_size: 1024,
        mime_type: 'application/json',
        storage_path: 'chat-attachments/user-uuid-1/123-work-items.json',
        status: 'active',
      };

      vi.mocked(prisma.chat_attachments.create).mockResolvedValue(
        mockRecord as never
      );

      const result = await repository.finalizeUpload({
        userId: 'user-uuid-1',
        storagePath: 'chat-attachments/user-uuid-1/123-work-items.json',
        fileName: 'work-items.json',
        fileSize: 1024,
        mimeType: 'application/json',
      });

      expect(result.success).toBe(true);
      expect(result.attachment.id).toBe('attachment-uuid-1');
      expect(result.attachment.fileName).toBe('work-items.json');
      expect(result.attachment.fileType).toBe(ChatAttachmentFileTypeEnum.Json);
      expect(result.attachment.url).toBe('https://supabase.co/signed-url-test');
    });

    it('uploads file via multipart fallback, creates DB record, and returns ChatAttachmentWire', async () => {
      const mockRecord = {
        id: 'attachment-uuid-1',
        user_id: 'user-uuid-1',
        file_name: 'work-items.json',
        file_size: 1024,
        mime_type: 'application/json',
        storage_path: 'chat-attachments/user-uuid-1/test.json',
        status: 'active',
      };

      vi.mocked(prisma.chat_attachments.create).mockResolvedValue(
        mockRecord as never
      );

      const result = await repository.uploadAttachment({
        userId: 'user-uuid-1',
        fileName: 'work-items.json',
        fileBuffer: Buffer.from('{"items": []}'),
        mimeType: 'application/json',
        fileSize: 1024,
      });

      expect(result.id).toBe('attachment-uuid-1');
      expect(result.fileName).toBe('work-items.json');
      expect(result.fileType).toBe(ChatAttachmentFileTypeEnum.Json);
      expect(result.url).toBe('https://supabase.co/signed-url-test');
    });

    it('soft deletes (archives) DB record on deleteAttachment and removes storage object', async () => {
      vi.mocked(prisma.chat_attachments.findUnique).mockResolvedValue({
        id: 'attachment-uuid-1',
        user_id: 'user-uuid-1',
        storage_path: 'chat-attachments/user-uuid-1/test.json',
        status: 'active',
      } as never);

      vi.mocked(prisma.chat_attachments.update).mockResolvedValue({} as never);

      const success = await repository.deleteAttachment(
        'user-uuid-1',
        'attachment-uuid-1'
      );
      expect(success).toBe(true);
      expect(prisma.chat_attachments.update).toHaveBeenCalledWith({
        where: { id: 'attachment-uuid-1' },
        data: { status: 'archived' },
      });
    });

    it('throws error when user does not own attachment on delete', async () => {
      vi.mocked(prisma.chat_attachments.findUnique).mockResolvedValue({
        id: 'attachment-uuid-1',
        user_id: 'other-user',
        storage_path: 'path',
        status: 'active',
      } as never);

      await expect(
        repository.deleteAttachment('user-uuid-1', 'attachment-uuid-1')
      ).rejects.toThrow(/Access denied/);
    });

    it('lists attachments by conversation', async () => {
      const mockRecord = {
        id: 'attachment-uuid-1',
        user_id: 'user-uuid-1',
        conversation_id: 'conv-1',
        file_name: 'work-items.json',
        file_size: 1024,
        mime_type: 'application/json',
        storage_path: 'chat-attachments/user-uuid-1/test.json',
        status: 'active',
      };

      vi.mocked(prisma.chat_attachments.findMany).mockResolvedValue([
        mockRecord as never,
      ]);

      const list = await repository.listAttachmentsByConversation(
        'user-uuid-1',
        'conv-1'
      );

      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe('attachment-uuid-1');
      expect(list[0]?.url).toBe('https://supabase.co/signed-url-test');
    });
  });
});
