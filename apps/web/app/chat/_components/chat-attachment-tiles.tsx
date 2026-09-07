'use client';

import React from 'react';
import {
  File,
  FileCode,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
  X,
} from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
import {
  ChatAttachmentFileTypeEnum,
  type ChatAttachmentWire,
} from '@repo/types';

export interface PendingChatAttachment extends ChatAttachmentWire {
  readonly isUploading?: boolean;
}

interface ChatAttachmentTilesProps {
  readonly attachments: PendingChatAttachment[];
  // eslint-disable-next-line no-unused-vars
  readonly onRemove: (attachmentId: string) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getAttachmentIcon(fileType: ChatAttachmentFileTypeEnum) {
  switch (fileType) {
    case ChatAttachmentFileTypeEnum.Json:
      return <FileCode className="text-amber-500 size-4 shrink-0" />;
    case ChatAttachmentFileTypeEnum.Csv:
      return <FileSpreadsheet className="text-emerald-500 size-4 shrink-0" />;
    case ChatAttachmentFileTypeEnum.Text:
      return <FileText className="text-blue-500 size-4 shrink-0" />;
    case ChatAttachmentFileTypeEnum.Image:
      return <ImageIcon className="text-purple-500 size-4 shrink-0" />;
    default:
      return <File className="text-muted-foreground size-4 shrink-0" />;
  }
}

export function ChatAttachmentTiles({
  attachments,
  onRemove,
  disabled = false,
  className,
}: Readonly<ChatAttachmentTilesProps>) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 px-1 pb-2',
        className
      )}
      role="list"
      aria-label="Attached files"
    >
      {attachments.map((attachment) => {
        const isUploading = attachment.isUploading ?? false;

        return (
          <div
            key={attachment.id}
            role="listitem"
            className={cn(
              'group bg-background border-border/80 text-foreground relative flex items-center gap-2.5 rounded-lg border px-3 py-1.5 shadow-xs transition-colors',
              isUploading && 'opacity-80'
            )}
          >
            {isUploading ? (
              <Loader2 className="text-primary size-4 shrink-0 animate-spin" />
            ) : (
              getAttachmentIcon(attachment.fileType)
            )}

            <div className="flex min-w-0 flex-col leading-tight">
              <span
                className="max-w-[12rem] truncate text-xs font-medium"
                title={attachment.fileName}
              >
                {attachment.fileName}
              </span>
              <span className="text-muted-foreground text-[10px]">
                {isUploading ? 'Uploading…' : formatBytes(attachment.fileSize)}
              </span>
            </div>

            {!isUploading && !disabled ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground -mr-1 size-5 rounded-full p-0.5"
                onClick={() => onRemove(attachment.id)}
                aria-label={`Remove attachment ${attachment.fileName}`}
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
