import { describe, it, expect, vi, beforeEach } from 'vitest';

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
      delete: vi.fn(),
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
      expect(detectChatAttachmentFileType('items.json', 'application/json')).toBe(
        ChatAttachmentFileTypeEnum.Json
      );
      expect(detectChatAttachmentFileType('data.JSON', 'text/plain')).toBe(
        ChatAttachmentFileTypeEnum.Json
      );
    });

    it('detects csv file types', () => {
      expect(detectChatAttachmentFileType('export.csv', 'text/csv')).toBe(
        ChatAttachmentFileTypeEnum.Csv
      );
      expect(detectChatAttachmentFileType('sheet.CSV', 'application/octet-stream')).toBe(
        ChatAttachmentFileTypeEnum.Csv
      );
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
      expect(detectChatAttachmentFileType('archive.zip', 'application/zip')).toBe(
        ChatAttachmentFileTypeEnum.Other
      );
    });
  });

  describe('upload and delete repository operations', () => {
    let mockSupabase: unknown;
    let repository: ChatAttachmentsRepository;

    beforeEach(() => {
      vi.clearAllMocks();

      mockSupabase = {
        storage: {
          listBuckets: vi.fn().mockResolvedValue({
            data: [{ name: 'alice_storage_chat_attachments' }],
            error: null,
          }),
          createBucket: vi.fn().mockResolvedValue({ error: null }),
          from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({ error: null }),
            createSignedUrl: vi.fn().mockResolvedValue({
              data: { signedUrl: 'https://supabase.co/signed-url-test' },
              error: null,
            }),
            remove: vi.fn().mockResolvedValue({ error: null }),
          }),
        },
      };

      repository = new ChatAttachmentsRepository(mockSupabase as never);
    });

    it('uploads file, creates DB record, and returns ChatAttachmentWire', async () => {
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

    it('deletes storage object and DB record on deleteAttachment', async () => {
      vi.mocked(prisma.chat_attachments.findUnique).mockResolvedValue({
        id: 'attachment-uuid-1',
        user_id: 'user-uuid-1',
        storage_path: 'chat-attachments/user-uuid-1/test.json',
      } as never);

      vi.mocked(prisma.chat_attachments.delete).mockResolvedValue({} as never);

      const success = await repository.deleteAttachment(
        'user-uuid-1',
        'attachment-uuid-1'
      );
      expect(success).toBe(true);
      expect(prisma.chat_attachments.delete).toHaveBeenCalledWith({
        where: { id: 'attachment-uuid-1' },
      });
    });

    it('throws error when user does not own attachment', async () => {
      vi.mocked(prisma.chat_attachments.findUnique).mockResolvedValue({
        id: 'attachment-uuid-1',
        user_id: 'other-user',
        storage_path: 'path',
      } as never);

      await expect(
        repository.deleteAttachment('user-uuid-1', 'attachment-uuid-1')
      ).rejects.toThrow(/Access denied/);
    });
  });
});
