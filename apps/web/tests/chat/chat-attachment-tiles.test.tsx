import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatAttachmentTiles } from '@/app/chat/_components/chat-attachment-tiles';
import { ChatAttachmentFileTypeEnum } from '@repo/types';

describe('ChatAttachmentTiles', () => {
  it('renders nothing when attachments array is empty', () => {
    const { container } = render(
      <ChatAttachmentTiles attachments={[]} onRemove={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders attachment tiles with file names and formatted sizes', () => {
    const onRemove = vi.fn();
    const attachments = [
      {
        id: 'att-1',
        fileName: 'work-items.json',
        fileSize: 2048,
        mimeType: 'application/json',
        storagePath: 'path/1',
        url: 'https://storage/1',
        fileType: ChatAttachmentFileTypeEnum.Json,
      },
      {
        id: 'att-2',
        fileName: 'tasks.csv',
        fileSize: 1048576,
        mimeType: 'text/csv',
        storagePath: 'path/2',
        url: 'https://storage/2',
        fileType: ChatAttachmentFileTypeEnum.Csv,
      },
    ];

    render(
      <ChatAttachmentTiles attachments={attachments} onRemove={onRemove} />
    );

    expect(screen.getByText('work-items.json')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(screen.getByText('tasks.csv')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();
  });

  it('renders uploading spinner and status when isUploading is true', () => {
    const onRemove = vi.fn();
    const attachments = [
      {
        id: 'att-uploading',
        fileName: 'import.json',
        fileSize: 1024,
        mimeType: 'application/json',
        storagePath: '',
        url: '',
        fileType: ChatAttachmentFileTypeEnum.Json,
        isUploading: true,
      },
    ];

    render(
      <ChatAttachmentTiles attachments={attachments} onRemove={onRemove} />
    );

    expect(screen.getByText('import.json')).toBeInTheDocument();
    expect(screen.getByText('Uploading…')).toBeInTheDocument();
  });

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    const attachments = [
      {
        id: 'att-to-remove',
        fileName: 'sample.json',
        fileSize: 500,
        mimeType: 'application/json',
        storagePath: 'path/sample',
        url: 'https://storage/sample',
        fileType: ChatAttachmentFileTypeEnum.Json,
      },
    ];

    render(
      <ChatAttachmentTiles attachments={attachments} onRemove={onRemove} />
    );

    const removeButton = screen.getByRole('button', {
      name: /Remove attachment sample\.json/i,
    });
    fireEvent.click(removeButton);

    expect(onRemove).toHaveBeenCalledWith('att-to-remove');
  });
});
