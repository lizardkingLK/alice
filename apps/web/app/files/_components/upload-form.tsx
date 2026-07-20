'use client';

import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import { Dropzone, type FileRejection } from '@repo/ui/components/ui/dropzone';
import { Progress } from '@repo/ui/components/ui/progress';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  AlertCircle,
  CheckCircle2,
  FileIcon,
  Loader2,
  UploadCloud,
  X,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { apiFetch } from '@/lib/api/api-client';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

type UploadResult = {
  success: boolean;
  path: string;
};

type UploadStatus = 'uploading' | 'success' | 'error';

type UploadItem = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  path?: string;
  error?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadFileToApi(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<UploadResult>('/api/files', {
    method: 'POST',
    body: formData,
  });
}

function bumpUploadProgress(items: UploadItem[], itemId: string): UploadItem[] {
  return items.map((current) => {
    if (
      current.id !== itemId ||
      current.status !== 'uploading' ||
      current.progress >= 90
    ) {
      return current;
    }

    return {
      ...current,
      progress: Math.min(current.progress + 12, 90),
    };
  });
}

type UploadItemUpdater = (
  // eslint-disable-next-line no-unused-vars
  id: string,
  // eslint-disable-next-line no-unused-vars
  patch: Partial<UploadItem>
) => void;

async function uploadOneItem(
  item: UploadItem,
  updateItem: UploadItemUpdater,
  setItems: Dispatch<SetStateAction<UploadItem[]>>
): Promise<boolean> {
  const progressTimer = globalThis.setInterval(() => {
    setItems((prev) => bumpUploadProgress(prev, item.id));
  }, 180);

  try {
    const result = await uploadFileToApi(item.file);
    globalThis.clearInterval(progressTimer);
    updateItem(item.id, {
      status: 'success',
      progress: 100,
      path: result.path,
    });
    return true;
  } catch (error) {
    globalThis.clearInterval(progressTimer);
    updateItem(item.id, {
      status: 'error',
      progress: 100,
      error: error instanceof Error ? error.message : 'Upload failed',
    });
    return false;
  }
}

function UploadStatusIcon({ status }: Readonly<{ status: UploadStatus }>) {
  if (status === 'uploading') {
    return <Loader2 className="size-4 animate-spin" />;
  }

  if (status === 'success') {
    return <CheckCircle2 className="size-4" />;
  }

  return <AlertCircle className="size-4" />;
}

function uploadStatusLabel(status: UploadStatus): string {
  if (status === 'uploading') {
    return 'Uploading…';
  }
  if (status === 'success') {
    return 'Upload complete';
  }
  return 'Upload failed';
}

function rejectionMessage(fileRejections: FileRejection[]): string | null {
  if (fileRejections.length === 0) {
    return null;
  }

  const firstError = fileRejections[0]?.errors[0];
  if (firstError?.code === 'file-too-large') {
    return 'Each file must be 10 MB or smaller.';
  }
  if (firstError?.code === 'too-many-files') {
    return 'Too many files selected at once.';
  }
  return firstError?.message ?? 'Some files could not be added.';
}

function ClosableAlert({
  tone,
  title,
  description,
  onClose,
}: Readonly<{
  tone: 'success' | 'error';
  title: string;
  description: string;
  onClose: () => void;
}>) {
  const isSuccess = tone === 'success';

  return (
    <output
      className={cn(
        'animate-in fade-in-0 slide-in-from-top-2 flex items-start gap-3 rounded-xl border p-3 duration-300 sm:p-4',
        isSuccess
          ? 'border-emerald-500/20 bg-emerald-500/5'
          : 'border-destructive/20 bg-destructive/10'
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
          isSuccess
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            : 'bg-destructive/10 text-destructive'
        )}
      >
        {isSuccess ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <AlertCircle className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p
          className={cn(
            'text-sm font-medium',
            isSuccess
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-destructive'
          )}
        >
          {title}
        </p>
        <p className="text-muted-foreground text-xs sm:text-sm">
          {description}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="cursor-pointer"
        aria-label={`Dismiss ${title}`}
        onClick={onClose}
      >
        <X />
      </Button>
    </output>
  );
}

function UploadItemCard({
  item,
  onDismiss,
}: Readonly<{
  item: UploadItem;
  onDismiss: () => void;
}>) {
  return (
    <li className="animate-in fade-in-0 slide-in-from-top-1 duration-300">
      <Card size="sm">
        <CardContent className="flex items-start gap-3 pt-0">
          <div
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border',
              item.status === 'success' &&
                'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              item.status === 'error' &&
                'border-destructive/30 bg-destructive/10 text-destructive',
              item.status === 'uploading' &&
                'border-border bg-muted text-muted-foreground'
            )}
          >
            <UploadStatusIcon status={item.status} />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <FileIcon className="text-muted-foreground size-3.5 shrink-0" />
                  <TruncatedText className="text-sm font-medium">
                    {item.file.name}
                  </TruncatedText>
                </div>
                <p className="text-muted-foreground text-xs">
                  {formatBytes(item.file.size)}
                  {item.path ? ` · ${item.path}` : null}
                  {item.error ? ` · ${item.error}` : null}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                aria-label={`Dismiss ${item.file.name}`}
                onClick={onDismiss}
                disabled={item.status === 'uploading'}
              >
                <X />
              </Button>
            </div>
            <Progress value={item.progress} className="h-1.5" />
            <p className="text-muted-foreground text-xs">
              {uploadStatusLabel(item.status)}
            </p>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

function UploadAlertsPanel({
  rootError,
  successCount,
  successAlertVisible,
  items,
  onDismissError,
  onDismissSuccess,
  onDismissItem,
}: Readonly<{
  rootError: string | null;
  successCount: number;
  successAlertVisible: boolean;
  items: UploadItem[];
  onDismissError: () => void;
  onDismissSuccess: () => void;
  // eslint-disable-next-line no-unused-vars
  onDismissItem: (id: string) => void;
}>) {
  const successDescription =
    successCount === 1
      ? '1 file uploaded successfully and is ready for attachments.'
      : `${successCount} files uploaded successfully and are ready for attachments.`;

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-2 flex w-full flex-col gap-3 duration-500 sm:gap-4">
      {rootError ? (
        <ClosableAlert
          tone="error"
          title="Upload issue"
          description={rootError}
          onClose={onDismissError}
        />
      ) : null}

      {successAlertVisible && successCount > 0 ? (
        <ClosableAlert
          tone="success"
          title="Upload complete"
          description={successDescription}
          onClose={onDismissSuccess}
        />
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <UploadItemCard
              key={item.id}
              item={item}
              onDismiss={() => onDismissItem(item.id)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function UploadFiles() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [rootError, setRootError] = useState<string | null>(null);
  const [successAlertVisible, setSuccessAlertVisible] = useState(false);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const startUploads = useCallback(
    async (files: File[]) => {
      const nextItems: UploadItem[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: 'uploading',
        progress: 15,
      }));

      setItems((prev) => [...nextItems, ...prev]);

      const results = await Promise.all(
        nextItems.map((item) => uploadOneItem(item, updateItem, setItems))
      );

      if (results.some(Boolean)) {
        setSuccessAlertVisible(true);
      }
    },
    [updateItem]
  );

  const handleDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setRootError(rejectionMessage(fileRejections));

      if (acceptedFiles.length === 0) {
        return;
      }

      startUploads(acceptedFiles).catch(() => {});
    },
    [startUploads]
  );

  const successCount = items.filter((item) => item.status === 'success').length;
  const uploadingCount = items.filter(
    (item) => item.status === 'uploading'
  ).length;

  const hasAlerts =
    Boolean(rootError) ||
    (successAlertVisible && successCount > 0) ||
    items.length > 0;
  const isCentered = !hasAlerts;

  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col px-1 transition-all duration-500 ease-in-out sm:px-2',
        isCentered
          ? 'min-h-[calc(100dvh-11rem)] max-w-4xl items-center justify-center gap-0'
          : 'min-h-0 max-w-2xl items-stretch justify-start gap-4 sm:gap-6'
      )}
    >
      <div
        className={cn(
          'w-full transition-all duration-500 ease-in-out',
          isCentered ? 'max-w-3xl' : 'max-w-2xl'
        )}
      >
        <Dropzone
          onDrop={handleDrop}
          maxSize={MAX_FILE_SIZE_BYTES}
          multiple
          className={cn(
            'transition-all duration-500 ease-in-out',
            isCentered
              ? 'min-h-64 gap-4 px-6 py-12 sm:min-h-80 sm:gap-5 sm:px-10 sm:py-16 md:min-h-96'
              : 'min-h-36 gap-2 px-4 py-6 sm:min-h-40 sm:px-6 sm:py-8'
          )}
        >
          <div
            className={cn(
              'bg-muted flex items-center justify-center rounded-full transition-all duration-500',
              isCentered ? 'size-14 sm:size-16' : 'size-10 sm:size-12'
            )}
          >
            <UploadCloud
              className={cn(
                'text-muted-foreground transition-all duration-500',
                isCentered ? 'size-7 sm:size-8' : 'size-5 sm:size-6'
              )}
            />
          </div>
          <div className="space-y-1 px-1 sm:px-2">
            <p
              className={cn(
                'font-medium transition-all duration-500',
                isCentered ? 'text-base sm:text-lg' : 'text-sm'
              )}
            >
              {uploadingCount > 0
                ? 'Uploading in progress — you can add more files anytime'
                : 'Drag and drop files here'}
            </p>
            <p
              className={cn(
                'text-muted-foreground transition-all duration-500',
                isCentered ? 'text-sm' : 'text-xs'
              )}
            >
              or click to browse · up to 10 MB per file
            </p>
          </div>
        </Dropzone>
      </div>

      {hasAlerts ? (
        <UploadAlertsPanel
          rootError={rootError}
          successCount={successCount}
          successAlertVisible={successAlertVisible}
          items={items}
          onDismissError={() => setRootError(null)}
          onDismissSuccess={() => setSuccessAlertVisible(false)}
          onDismissItem={removeItem}
        />
      ) : null}
    </div>
  );
}
