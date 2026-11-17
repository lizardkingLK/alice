'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { ImagePlus, Trash2 } from '@repo/ui/lib/icons';
import { ImagePositionUploadDialog } from '@/components/image-position-upload-dialog';
import {
  assertNoteCoverDataUrl,
  readFileAsDataUrl,
} from '@/app/notes/_helpers/notes-cover';

type NotesCoverBannerProps = {
  readonly coverDataUrl: string | null;
  // eslint-disable-next-line no-unused-vars -- cover callback
  readonly onChange: (coverDataUrl: string | null) => void;
};

export function NotesCoverBanner({
  coverDataUrl,
  onChange,
}: Readonly<NotesCoverBannerProps>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const dataUrl = assertNoteCoverDataUrl(await readFileAsDataUrl(file));
      onChange(dataUrl);
      setDialogOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not save cover.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group relative mb-3 w-full shrink-0 overflow-hidden rounded-lg">
      {coverDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local data URL cover
        <img
          src={coverDataUrl}
          alt=""
          className="h-36 w-full object-cover md:h-44"
        />
      ) : (
        <div className="bg-muted/40 flex h-24 items-center justify-center md:h-28">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              setError(null);
              setDialogOpen(true);
            }}
          >
            <ImagePlus data-icon="inline-start" />
            Add cover
          </Button>
        </div>
      )}

      {coverDataUrl ? (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              setError(null);
              setDialogOpen(true);
            }}
          >
            Change
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Remove cover"
            onClick={() => onChange(null)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ) : null}

      <ImagePositionUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Note cover"
        description="Crop a wide image for this note. It stays on this device."
        aspect="cover"
        confirmLabel="Use cover"
        isUploading={busy}
        error={error}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
