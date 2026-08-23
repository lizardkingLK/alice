'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
import { ImagePositionUploadDialog } from '@/components/image-position-upload-dialog';
import { applyLockedImageUploadOutcome } from '@/lib/image-position/apply-locked-image-upload';
import { uploadLockedImage } from '@/lib/image-position/upload-locked-image';

type CoverUploadResult = {
  success: boolean;
  url: string;
  path: string;
  user: {
    updated_at: string;
  };
};

type ProfileCoverBannerProps = {
  coverUrl: string | null;
  updatedAt: string;
};

export function ProfileCoverBanner({
  coverUrl: initialCoverUrl,
  updatedAt: initialUpdatedAt,
}: Readonly<ProfileCoverBannerProps>) {
  const router = useRouter();
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setCoverUrl(initialCoverUrl);
    setUpdatedAt(initialUpdatedAt);
  }, [initialCoverUrl, initialUpdatedAt]);

  const handleConfirm = async (file: File) => {
    setIsUploading(true);
    setError(null);

    const outcome = await uploadLockedImage<CoverUploadResult>({
      path: '/api/profile/cover',
      file,
      expectedUpdatedAt: updatedAt,
      conflictMessage:
        'Someone else updated your profile. Refresh, then upload your cover again.',
      failureFallback: 'Failed to upload cover photo.',
    });

    applyLockedImageUploadOutcome(outcome, {
      onSuccess: (result) => {
        setCoverUrl(result.url);
        setUpdatedAt(result.user.updated_at);
        setDialogOpen(false);
        router.refresh();
      },
      onConflictUpdatedAt: setUpdatedAt,
      onFailure: setError,
    });

    setIsUploading(false);
  };

  return (
    <>
      <div
        className={cn(
          'relative h-40 w-full overflow-hidden sm:h-48 md:h-56',
          !coverUrl &&
            'bg-linear-to-br from-sky-700 via-teal-700 to-emerald-800'
        )}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- public Storage URL
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(0,0,0,0.25),transparent_50%)]"
            aria-hidden
          />
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/25 to-transparent"
          aria-hidden
        />
        <div className="absolute end-3 top-3 z-10 sm:end-4 sm:top-4">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="bg-background/90 hover:bg-background shadow-sm backdrop-blur-sm"
            onClick={() => {
              setError(null);
              setDialogOpen(true);
            }}
          >
            <ImagePlus data-icon="inline-start" />
            {coverUrl ? 'Change cover' : 'Add cover'}
          </Button>
        </div>
      </div>

      <ImagePositionUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Cover photo"
        description="Drop one image, then drag and zoom to frame your cover. JPEG, PNG, WebP, or GIF up to 2 MB."
        aspect="cover"
        confirmLabel="Save cover"
        isUploading={isUploading}
        error={error}
        onConfirm={handleConfirm}
      />
    </>
  );
}
