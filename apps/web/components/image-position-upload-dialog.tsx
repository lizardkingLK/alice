'use client';

import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
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
import { Label } from '@repo/ui/components/ui/label';
import { Loader2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { cropImageToFile } from '@/lib/image-position/crop-image';

const IMAGE_ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
} as const;

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

export type ImagePositionAspect = 'avatar' | 'cover' | 'logo';

const ASPECT_BY_KIND: Record<ImagePositionAspect, number> = {
  avatar: 1,
  logo: 1,
  cover: 21 / 9,
};

type ImagePositionUploadDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- dialog open change
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly aspect: ImagePositionAspect;
  readonly confirmLabel?: string;
  readonly maxBytes?: number;
  readonly isUploading?: boolean;
  readonly error?: string | null;
  // eslint-disable-next-line no-unused-vars -- cropped file callback
  readonly onConfirm: (file: File) => void | Promise<void>;
};

/**
 * Single-file Dropzone + pan/zoom crop (`react-easy-crop`) for profile/project
 * images. Attachments keep their own multi-file Dropzone without cropping.
 */
export function ImagePositionUploadDialog({
  open,
  onOpenChange,
  title,
  description,
  aspect,
  confirmLabel = 'Save',
  maxBytes = DEFAULT_MAX_BYTES,
  isUploading = false,
  error = null,
  onConfirm,
}: Readonly<ImagePositionUploadDialogProps>) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState('image.jpg');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const reset = useCallback(() => {
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
    setSourceUrl(null);
    setSourceName('image.jpg');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setLocalError(null);
    setIsPreparing(false);
  }, [sourceUrl]);

  useEffect(() => {
    if (!open) {
      reset();
    }
    // Only reset when the dialog closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open gate
  }, [open]);

  const handleDrop = (accepted: File[], rejections: FileRejection[]) => {
    if (rejections.length > 0) {
      setLocalError('Use a JPEG, PNG, WebP, or GIF image.');
      return;
    }

    const file = accepted[0];
    if (!file) {
      return;
    }

    if (file.size > maxBytes) {
      setLocalError(
        `Image must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller.`
      );
      return;
    }

    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
    setLocalError(null);
    setSourceName(file.name);
    setSourceUrl(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const handleConfirm = async () => {
    if (!sourceUrl || !croppedAreaPixels) {
      setLocalError('Drop an image and adjust the position first.');
      return;
    }

    setIsPreparing(true);
    setLocalError(null);
    try {
      const file = await cropImageToFile(
        sourceUrl,
        croppedAreaPixels,
        sourceName
      );
      await onConfirm(file);
    } catch (prepareError) {
      setLocalError(
        prepareError instanceof Error
          ? prepareError.message
          : 'Failed to prepare the image.'
      );
    } finally {
      setIsPreparing(false);
    }
  };

  const busy = isUploading || isPreparing;
  const displayError = localError ?? error;
  const aspectRatio = ASPECT_BY_KIND[aspect];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) {
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {sourceUrl ? (
            <>
              <div
                className={cn(
                  'bg-muted relative w-full overflow-hidden rounded-lg',
                  aspect === 'cover' ? 'h-48 sm:h-56' : 'mx-auto size-56'
                )}
              >
                <Cropper
                  image={sourceUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspectRatio}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_area, pixels) =>
                    setCroppedAreaPixels(pixels)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-position-zoom" className="text-xs">
                  Zoom
                </Label>
                <input
                  id="image-position-zoom"
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  disabled={busy}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="accent-primary w-full"
                />
                <p className="text-muted-foreground text-xs">
                  Drag to reposition. Use zoom to frame the image.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={reset}
              >
                Choose a different image
              </Button>
            </>
          ) : (
            <Dropzone
              multiple={false}
              maxFiles={1}
              maxSize={maxBytes}
              accept={IMAGE_ACCEPT}
              disabled={busy}
              onDrop={handleDrop}
              className="min-h-40"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Drag and drop one image here
                </p>
                <p className="text-muted-foreground text-xs">
                  or click to browse (JPEG, PNG, WebP, GIF · max{' '}
                  {Math.round(maxBytes / (1024 * 1024))} MB)
                </p>
              </div>
            </Dropzone>
          )}

          {displayError ? (
            <p className="text-destructive text-sm" role="alert">
              {displayError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !sourceUrl || !croppedAreaPixels}
            onClick={() => void handleConfirm()}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
