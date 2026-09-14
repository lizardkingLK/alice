import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ChatAttachmentLink,
  isAttachmentUrlExpired,
} from '@/app/chat/_components/chat-attachment-link';
import { ChatAttachmentFileTypeEnum } from '@repo/types';
import * as chatAttachmentsClient from '@/app/chat/_services/chat-attachments.client';

vi.mock('@/app/chat/_services/chat-attachments.client', () => ({
  mintChatAttachmentUrls: vi.fn(),
}));

describe('ChatAttachmentLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  describe('isAttachmentUrlExpired', () => {
    it('returns true when expiresAt is undefined or null', () => {
      expect(isAttachmentUrlExpired(undefined)).toBe(true);
      expect(isAttachmentUrlExpired(null)).toBe(true);
    });

    it('returns true when expiresAt has passed', () => {
      const past = new Date(Date.now() - 60000).toISOString();
      expect(isAttachmentUrlExpired(past)).toBe(true);
    });

    it('returns true when expiresAt is within the 60s grace buffer', () => {
      const soon = new Date(Date.now() + 30000).toISOString();
      expect(isAttachmentUrlExpired(soon)).toBe(true);
    });

    it('returns false when expiresAt is well into the future', () => {
      const future = new Date(Date.now() + 3600000).toISOString();
      expect(isAttachmentUrlExpired(future)).toBe(false);
    });
  });

  describe('Component rendering and interactions', () => {
    it('renders attachment file name', () => {
      const attachment = {
        id: 'att-1',
        fileName: 'report.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storagePath: 'path/report.pdf',
        url: 'https://storage/report.pdf',
        fileType: ChatAttachmentFileTypeEnum.Other,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      render(<ChatAttachmentLink attachment={attachment} />);
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    it('opens existing URL directly when not expired', () => {
      const attachment = {
        id: 'att-1',
        fileName: 'report.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storagePath: 'path/report.pdf',
        url: 'https://storage/report.pdf?token=valid',
        fileType: ChatAttachmentFileTypeEnum.Other,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      render(<ChatAttachmentLink attachment={attachment} />);
      const link = screen.getByRole('link', { name: /Attachment report\.pdf/i });
      fireEvent.click(link);

      expect(chatAttachmentsClient.mintChatAttachmentUrls).not.toHaveBeenCalled();
      expect(window.open).toHaveBeenCalledWith(
        'https://storage/report.pdf?token=valid',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('refreshes URL and opens fresh link when expired', async () => {
      const attachment = {
        id: 'att-expired',
        fileName: 'expired.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storagePath: 'path/expired.pdf',
        url: 'https://storage/expired.pdf?token=old',
        fileType: ChatAttachmentFileTypeEnum.Other,
        expiresAt: new Date(Date.now() - 3600000).toISOString(),
      };

      vi.mocked(chatAttachmentsClient.mintChatAttachmentUrls).mockResolvedValueOnce({
        previewUrl: 'https://storage/expired.pdf?token=fresh',
        downloadUrl: 'https://storage/expired.pdf?token=fresh-dl',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      render(<ChatAttachmentLink attachment={attachment} />);
      const link = screen.getByRole('link', { name: /Attachment expired\.pdf/i });
      fireEvent.click(link);

      expect(chatAttachmentsClient.mintChatAttachmentUrls).toHaveBeenCalledWith('att-expired');

      await waitFor(() => {
        expect(window.open).toHaveBeenCalledWith(
          'https://storage/expired.pdf?token=fresh',
          '_blank',
          'noopener,noreferrer'
        );
      });
    });
  });
});
