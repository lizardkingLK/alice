'use client';

import { useEffect, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Dropzone, type FileRejection } from '@repo/ui/components/ui/dropzone';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { toast } from '@repo/ui/components/ui/sonner';
import { Loader2, X } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { formatFileSize } from '@/app/_shared/utility';
import type { AttachmentWithUploader } from '@repo/types';
import { uploadWorkItemAttachment } from '@/app/attachments/_services/attachments.mutations.client';
import { UploadStatusIcon } from '@/components/upload-status-icon';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

type ItemStatus = 'pending' | 'uploading' | 'success' | 'error';

type UploadItem = {
  id: string;
  file: File;
  status: ItemStatus;
  error?: string;
};

function itemId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
}

/* eslint-disable no-unused-vars */
type WorkItemAttachmentUploadDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly workItemId: string;
  readonly onUploaded: (attachment: AttachmentWithUploader) => void;
};
/* eslint-enable no-unused-vars */

export function WorkItemAttachmentUploadDialog({
  open,
  onOpenChange,
  workItemId,
  onUploaded,
}: Readonly<WorkItemAttachmentUploadDialogProps>) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setItems([]);
      setIsUploading(false);
    }
  }, [open]);

  function handleDrop(accepted: File[], rejections: FileRejection[]) {
    if (rejections.length > 0) {
      toast.error('Some files were rejected (max 10 MB each).');
    }

    const withinLimit = accepted.filter(
      (file) => file.size <= MAX_FILE_SIZE_BYTES
    );
    if (withinLimit.length < accepted.length) {
      toast.error('Files must be 10 MB or smaller.');
    }

    setItems((prev) => [
      ...prev,
      ...withinLimit.map((file) => ({
        id: itemId(file),
        file,
        status: 'pending' as ItemStatus,
      })),
    ]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function patchItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  async function handleUpload() {
    const pending = items.filter((item) => item.status !== 'success');
    if (pending.length === 0) {
      return;
    }

    setIsUploading(true);
    let successCount = 0;

    for (const item of pending) {
      patchItem(item.id, { status: 'uploading', error: undefined });
      try {
        const result = await uploadWorkItemAttachment(item.file, workItemId);
        if (result.attachment) {
          onUploaded(result.attachment);
        }
        patchItem(item.id, { status: 'success' });
        successCount += 1;
      } catch (error) {
        patchItem(item.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed.',
        });
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? 'Attachment uploaded.'
          : `${successCount} attachments uploaded.`
      );
    }

    const anyFailed = items.some((item) => item.status === 'error');
    if (!anyFailed && successCount > 0) {
      onOpenChange(false);
    }
  }

  const hasPending = items.some((item) => item.status !== 'success');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/80 w-full min-w-0 overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add attachments</DialogTitle>
          <DialogDescription>
            Drag and drop files or browse. Up to 10 MB each.
          </DialogDescription>
        </DialogHeader>

        <div className="w-full min-w-0 space-y-3 overflow-hidden py-1">
          <Dropzone
            multiple
            onDrop={handleDrop}
            disabled={isUploading}
            className="min-h-32 max-w-full sm:min-h-36"
          />

          {items.length > 0 ? (
            <ul className="max-h-56 w-full min-w-0 space-y-2 overflow-x-hidden overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'border-border flex w-full max-w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg border px-3 py-2'
                  )}
                >
                  <div className="shrink-0">
                    <UploadStatusIcon status={item.status} />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <TruncatedText className="text-sm font-medium">
                      {item.file.name}
                    </TruncatedText>
                    {item.status === 'error' ? (
                      <TruncatedText className="text-muted-foreground text-xs">
                        {item.error ?? 'Upload failed'}
                      </TruncatedText>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        {formatFileSize(item.file.size)}
                      </p>
                    )}
                  </div>
                  {item.status !== 'uploading' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 cursor-pointer"
                      aria-label={`Remove ${item.file.name}`}
                      onClick={() => removeItem(item.id)}
                    >
                      <X />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isUploading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isUploading || items.length === 0 || !hasPending}
            onClick={handleUpload}
          >
            {isUploading ? (
              <>
                <Loader2 className="animate-spin" />
                Uploading...
              </>
            ) : (
              'Upload'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
