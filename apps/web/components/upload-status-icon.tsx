import {
  AlertCircle,
  CheckCircle2,
  FileIcon,
  Loader2,
} from '@repo/ui/lib/icons';

export type UploadStatusIconState =
  'pending' | 'uploading' | 'success' | 'error';

/** Shared status glyph for file upload queues (details dialog, /files page). */
export function UploadStatusIcon({
  status,
}: Readonly<{ status: UploadStatusIconState }>) {
  if (status === 'uploading') {
    return <Loader2 className="text-muted-foreground size-4 animate-spin" />;
  }
  if (status === 'success') {
    return <CheckCircle2 className="size-4 text-emerald-500" />;
  }
  if (status === 'error') {
    return <AlertCircle className="text-destructive size-4" />;
  }
  return <FileIcon className="text-muted-foreground size-4" />;
}
