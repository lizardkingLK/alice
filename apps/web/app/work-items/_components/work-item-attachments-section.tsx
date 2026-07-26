'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate, formatFileSize } from '@/app/_shared/utility';
import type { AttachmentWithUploader } from '@repo/types';
import { ApiError } from '@/lib/api/api';
import {
  deleteWorkItemAttachment,
  mintAttachmentUrls,
  type AttachmentSignedUrls,
} from '@/app/work-items/_services/attachments.service';
import { WorkItemAttachmentUploadDialog } from '@/app/work-items/_components/work-item-attachment-upload-dialog';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { toast } from '@repo/ui/components/ui/sonner';
import { cn } from '@repo/ui/lib/utils';
import {
  Download,
  FileX2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from '@repo/ui/lib/icons';
import {
  AttachmentFileIcon,
  isAttachmentPreviewable,
  resolveAttachmentIconKind,
  type AttachmentIconKind,
} from '@/app/work-items/_helpers/attachment-file-icon';

/** Matches `@repo/ui` DialogContent exit animation (`duration-200`). */
const VIEWER_CLOSE_MS = 200;

type CachedUrls = AttachmentSignedUrls;

function attachmentMeta(attachment: AttachmentWithUploader): string {
  return `${formatDate(attachment.created_at)} · ${formatFileSize(attachment.file_size)}`;
}

function AttachmentCard({
  name,
  meta,
  iconKind,
  onOpen,
}: Readonly<{
  name: string;
  meta: string;
  iconKind: AttachmentIconKind;
  onOpen: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-42 shrink-0 cursor-pointer text-left"
      aria-label={`Open attachment ${name}`}
    >
      <Card
        className={cn(
          'border-border bg-card hover:border-primary/40 w-full overflow-hidden py-0 shadow-none transition-colors'
        )}
      >
        <div
          className={cn(
            'bg-muted flex h-24 items-center justify-center border-b'
          )}
        >
          <AttachmentFileIcon kind={iconKind} className="size-8" />
        </div>
        <CardContent className="min-w-0 space-y-0.5 px-3 py-2.5">
          <TruncatedText className="text-sm font-medium">{name}</TruncatedText>
          <p className="text-muted-foreground truncate text-xs">{meta}</p>
        </CardContent>
      </Card>
    </button>
  );
}

function ExpiredOrMissingPreview({
  previewFailed,
  onRegenerate,
  loading,
}: Readonly<{
  previewFailed: boolean;
  onRegenerate: () => void;
  loading: boolean;
}>) {
  return (
    <div className="space-y-3 px-6 py-8 text-center">
      <p className="text-muted-foreground text-sm">
        {previewFailed
          ? 'This link no longer works. Generate a new link to continue.'
          : 'Unable to load preview.'}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer"
        onClick={onRegenerate}
        disabled={loading}
      >
        <RefreshCw data-icon="inline-start" />
        Generate new link
      </Button>
    </div>
  );
}

function MediaPreview({
  iconKind,
  fileName,
  previewUrl,
  canPreview,
  onError,
}: Readonly<{
  iconKind: AttachmentIconKind;
  fileName: string;
  previewUrl: string;
  canPreview: boolean;
  onError: () => void;
}>) {
  if (canPreview && iconKind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, ephemeral
      <img
        key={previewUrl}
        src={previewUrl}
        alt={fileName}
        className="max-h-[60vh] w-full object-contain"
        onError={onError}
      />
    );
  }

  if (canPreview && iconKind === 'pdf') {
    return (
      <iframe
        key={previewUrl}
        title={fileName}
        src={previewUrl}
        className="h-[60vh] w-full border-0"
        onError={onError}
      />
    );
  }

  return (
    <div className="space-y-2 px-6 py-8 text-center">
      <AttachmentFileIcon kind={iconKind} className="mx-auto size-10" />
      <p className="text-muted-foreground text-sm">
        Preview is not available for this file type. Download to open it.
      </p>
    </div>
  );
}

function UnavailablePreview({
  onRemove,
  removing,
}: Readonly<{
  onRemove: () => void;
  removing: boolean;
}>) {
  return (
    <div className="space-y-3 px-6 py-8 text-center">
      <FileX2 className="text-muted-foreground mx-auto size-10" />
      <p className="text-muted-foreground text-sm">
        This file is no longer available in storage. You can remove the
        attachment record.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive cursor-pointer"
        onClick={onRemove}
        disabled={removing}
      >
        {removing ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : (
          <Trash2 data-icon="inline-start" />
        )}
        Remove attachment
      </Button>
    </div>
  );
}

function AttachmentPreviewPane({
  loading,
  unavailable,
  previewFailed,
  urls,
  canPreview,
  iconKind,
  fileName,
  onRegenerate,
  onPreviewError,
  onRemove,
  removing,
}: Readonly<{
  loading: boolean;
  unavailable: boolean;
  previewFailed: boolean;
  urls: CachedUrls | null;
  canPreview: boolean;
  iconKind: AttachmentIconKind;
  fileName: string;
  onRegenerate: () => void;
  onPreviewError: () => void;
  onRemove: () => void;
  removing: boolean;
}>) {
  if (loading) {
    return <Loader2 className="text-muted-foreground size-8 animate-spin" />;
  }

  if (unavailable) {
    return <UnavailablePreview onRemove={onRemove} removing={removing} />;
  }

  if (previewFailed || !urls) {
    return (
      <ExpiredOrMissingPreview
        previewFailed={previewFailed}
        onRegenerate={onRegenerate}
        loading={loading}
      />
    );
  }

  return (
    <MediaPreview
      iconKind={iconKind}
      fileName={fileName}
      previewUrl={urls.previewUrl}
      canPreview={canPreview}
      onError={onPreviewError}
    />
  );
}

/* eslint-disable no-unused-vars */
type AttachmentsSectionProps = {
  workItemId: string;
  initialAttachments: AttachmentWithUploader[];
  uploadOpen: boolean;
  onUploadOpenChange: (open: boolean) => void;
};
/* eslint-enable no-unused-vars */

export function AttachmentsSection({
  workItemId,
  initialAttachments,
  uploadOpen,
  onUploadOpenChange,
}: Readonly<AttachmentsSectionProps>) {
  const router = useRouter();
  const urlCacheRef = useRef<Map<string, CachedUrls>>(new Map());
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [attachments, setAttachments] =
    useState<AttachmentWithUploader[]>(initialAttachments);
  const [active, setActive] = useState<AttachmentWithUploader | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [urls, setUrls] = useState<CachedUrls | null>(null);
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setAttachments(initialAttachments);
  }, [initialAttachments]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function clearViewerContent() {
    setActive(null);
    setUrls(null);
    setPreviewFailed(false);
    setUnavailable(false);
    setLoadingUrls(false);
  }

  /**
   * Close the dialog first (exit animation), then unmount preview content so
   * outside-click / X don't flash an empty pane mid-close.
   */
  function closeViewer() {
    setViewerOpen(false);
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      clearViewerContent();
      closeTimerRef.current = null;
    }, VIEWER_CLOSE_MS);
  }

  function cancelPendingClose() {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  async function resolveUrls(
    attachment: AttachmentWithUploader,
    forceRefresh: boolean
  ): Promise<CachedUrls> {
    if (!forceRefresh) {
      const cached = urlCacheRef.current.get(attachment.id);
      if (cached) {
        return cached;
      }
    }

    const minted = await mintAttachmentUrls(attachment.id);
    urlCacheRef.current.set(attachment.id, minted);
    return minted;
  }

  /** Returns true when handled as a "gone" (410) case. */
  function handleMintError(error: unknown, fallback: string): boolean {
    if (error instanceof ApiError && error.status === 410) {
      urlCacheRef.current.delete(active?.id ?? '');
      setUrls(null);
      setPreviewFailed(false);
      setUnavailable(true);
      return true;
    }
    toast.error(error instanceof Error ? error.message : fallback);
    return false;
  }

  async function openAttachment(attachment: AttachmentWithUploader) {
    cancelPendingClose();
    setActive(attachment);
    setViewerOpen(true);
    setPreviewFailed(false);
    setUnavailable(false);
    setUrls(null);
    setLoadingUrls(true);

    try {
      const resolved = await resolveUrls(attachment, false);
      setUrls(resolved);
      setLoadingUrls(false);
    } catch (error) {
      if (handleMintError(error, 'Failed to open attachment.')) {
        setLoadingUrls(false);
      } else {
        // Keep current pane until exit animation finishes (avoid empty flash).
        closeViewer();
      }
    }
  }

  async function regenerateLink() {
    if (!active) {
      return;
    }

    setLoadingUrls(true);
    setPreviewFailed(false);

    try {
      const resolved = await resolveUrls(active, true);
      setUrls(resolved);
      toast.success('New link generated.');
    } catch (error) {
      handleMintError(error, 'Failed to generate a new link.');
    } finally {
      setLoadingUrls(false);
    }
  }

  async function handleDelete() {
    if (!active) {
      return;
    }

    setDeleting(true);
    try {
      await deleteWorkItemAttachment(active.id);
      urlCacheRef.current.delete(active.id);
      setAttachments((prev) => prev.filter((item) => item.id !== active.id));
      closeViewer();
      toast.success('Attachment deleted.');
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete attachment.';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  function handleUploaded(attachment: AttachmentWithUploader) {
    setAttachments((prev) => [
      attachment,
      ...prev.filter((item) => item.id !== attachment.id),
    ]);
    router.refresh();
  }

  const iconKind = active
    ? resolveAttachmentIconKind(active.file_name, active.mime_type)
    : 'generic';
  const canPreview = active ? isAttachmentPreviewable(active.mime_type) : false;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Attachments{' '}
          <span className="text-muted-foreground font-normal">
            ({attachments.length})
          </span>
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          className="cursor-pointer"
          aria-label="Add attachment"
          onClick={() => onUploadOpenChange(true)}
        >
          <Plus />
        </Button>
      </div>

      {attachments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No attachments yet.</p>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {attachments.map((attachment) => (
            <AttachmentCard
              key={attachment.id}
              name={attachment.file_name}
              meta={attachmentMeta(attachment)}
              iconKind={resolveAttachmentIconKind(
                attachment.file_name,
                attachment.mime_type
              )}
              onOpen={() => {
                void openAttachment(attachment);
              }}
            />
          ))}
        </div>
      )}

      <WorkItemAttachmentUploadDialog
        open={uploadOpen}
        onOpenChange={onUploadOpenChange}
        workItemId={workItemId}
        onUploaded={handleUploaded}
      />

      <Dialog
        open={viewerOpen}
        onOpenChange={(open) => {
          if (open) {
            setViewerOpen(true);
            return;
          }
          closeViewer();
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              <TruncatedText className="pr-8">
                {active?.file_name ?? 'Attachment'}
              </TruncatedText>
            </DialogTitle>
            {active ? (
              <DialogDescription>{attachmentMeta(active)}</DialogDescription>
            ) : null}
          </DialogHeader>

          <div className="bg-muted/40 flex min-h-64 items-center justify-center overflow-hidden rounded-lg border">
            <AttachmentPreviewPane
              loading={loadingUrls}
              unavailable={unavailable}
              previewFailed={previewFailed}
              urls={urls}
              canPreview={canPreview}
              iconKind={iconKind}
              fileName={active?.file_name ?? 'Attachment'}
              onRegenerate={() => {
                void regenerateLink();
              }}
              onPreviewError={() => setPreviewFailed(true)}
              onRemove={() => {
                void handleDelete();
              }}
              removing={deleting}
            />
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive cursor-pointer"
              onClick={() => {
                void handleDelete();
              }}
              disabled={deleting || loadingUrls}
            >
              {deleting ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              Delete
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {urls && !previewFailed && !unavailable ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => {
                    void regenerateLink();
                  }}
                  disabled={loadingUrls}
                >
                  <RefreshCw data-icon="inline-start" />
                  Refresh link
                </Button>
              ) : null}
              {urls && active && !loadingUrls ? (
                <Button asChild size="sm">
                  <a
                    href={urls.downloadUrl}
                    download={active.file_name}
                    rel="noopener noreferrer"
                  >
                    <Download data-icon="inline-start" />
                    Download
                  </a>
                </Button>
              ) : (
                <Button size="sm" disabled>
                  <Download data-icon="inline-start" />
                  Download
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
