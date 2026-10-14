import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UploadedAttachmentResult } from '@repo/types/api/v1';
import { uploadWorkItemAttachment } from '@/app/attachments/_services/attachments.mutations.client';
import { WorkItemAttachmentUploadDialog } from '@/app/work-items/_components/work-item-attachments/work-item-attachment-upload-dialog';

vi.mock('@/app/attachments/_services/attachments.mutations.client', () => ({
  uploadWorkItemAttachment: vi.fn(),
}));

vi.mock('@repo/ui/components/ui/sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/* eslint-disable no-unused-vars -- resolver callback type for deferred mocks */
type UploadResolver = (result: UploadedAttachmentResult) => void;
/* eslint-enable no-unused-vars */

function pasteFiles(files: File[]) {
  const clipboardData = {
    files,
  };
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: clipboardData,
  });
  act(() => {
    document.dispatchEvent(event);
  });
}

describe('WorkItemAttachmentUploadDialog', () => {
  it('enqueues pasted files while the dialog is open', async () => {
    // Arrange
    render(
      <WorkItemAttachmentUploadDialog
        open
        onOpenChange={vi.fn()}
        workItemId="wi-1"
        onUploaded={vi.fn()}
      />
    );
    const file = new File(['hello'], 'pasted-note.txt', { type: 'text/plain' });

    // Act
    pasteFiles([file]);

    // Assert
    expect(await screen.findByText('pasted-note.txt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Upload$/i })).toBeEnabled();
  });

  it('ignores paste when the dialog is closed', () => {
    // Arrange
    render(
      <WorkItemAttachmentUploadDialog
        open={false}
        onOpenChange={vi.fn()}
        workItemId="wi-1"
        onUploaded={vi.fn()}
      />
    );
    const file = new File(['hello'], 'closed-paste.txt', {
      type: 'text/plain',
    });

    // Act
    pasteFiles([file]);

    // Assert
    expect(screen.queryByText('closed-paste.txt')).not.toBeInTheDocument();
  });

  it('ignores paste while an upload is in progress', async () => {
    // Arrange
    let resolveUpload: UploadResolver | undefined;
    vi.mocked(uploadWorkItemAttachment).mockImplementation(
      () =>
        new Promise<UploadedAttachmentResult>((resolve) => {
          resolveUpload = resolve;
        })
    );

    render(
      <WorkItemAttachmentUploadDialog
        open
        onOpenChange={vi.fn()}
        workItemId="wi-1"
        onUploaded={vi.fn()}
      />
    );

    const first = new File(['one'], 'first.txt', { type: 'text/plain' });
    pasteFiles([first]);
    expect(await screen.findByText('first.txt')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Upload$/i }));
    expect(await screen.findByText(/Uploading/i)).toBeInTheDocument();

    // Act — paste while uploading
    const second = new File(['two'], 'during-upload.txt', {
      type: 'text/plain',
    });
    pasteFiles([second]);

    // Assert
    expect(screen.queryByText('during-upload.txt')).not.toBeInTheDocument();

    resolveUpload?.({
      success: true,
      path: 'attachments/wi-1/first.txt',
      url: 'https://example.com/first.txt',
    });
    await waitFor(() => {
      expect(screen.queryByText(/Uploading/i)).not.toBeInTheDocument();
    });
  });

  it('uploads multiple pending files in parallel', async () => {
    // Arrange
    const resolvers: UploadResolver[] = [];
    vi.mocked(uploadWorkItemAttachment).mockImplementation(
      () =>
        new Promise<UploadedAttachmentResult>((resolve) => {
          resolvers.push(resolve);
        })
    );
    const onOpenChange = vi.fn();

    render(
      <WorkItemAttachmentUploadDialog
        open
        onOpenChange={onOpenChange}
        workItemId="wi-1"
        onUploaded={vi.fn()}
      />
    );

    pasteFiles([
      new File(['a'], 'a.txt', { type: 'text/plain' }),
      new File(['b'], 'b.txt', { type: 'text/plain' }),
    ]);
    expect(await screen.findByText('a.txt')).toBeInTheDocument();
    expect(screen.getByText('b.txt')).toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^Upload$/i }));

    // Assert — both uploads started before either resolves
    await waitFor(() => {
      expect(uploadWorkItemAttachment).toHaveBeenCalledTimes(2);
    });
    expect(resolvers).toHaveLength(2);

    resolvers[0]!({
      success: true,
      path: 'attachments/wi-1/a.txt',
      url: 'https://example.com/a.txt',
    });
    resolvers[1]!({
      success: true,
      path: 'attachments/wi-1/b.txt',
      url: 'https://example.com/b.txt',
    });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
