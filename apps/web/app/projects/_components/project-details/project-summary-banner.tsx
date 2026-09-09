'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Calendar,
  CheckCircle,
  AlertCircle,
  ImagePlus,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { formatDate } from '@/app/_shared/utility';
import { ImagePositionUploadDialog } from '@/components/image-position-upload-dialog';
import { applyLockedImageUploadOutcome } from '@/lib/image-position/apply-locked-image-upload';
import { uploadLockedImage } from '@/lib/image-position/upload-locked-image';
import type { Project } from '../../_services/projects.mutations.client';

type ProjectImageUploadResult = {
  success: boolean;
  url: string;
  path: string;
  project: {
    updated_at: string;
    logo_url?: string | null;
    cover_picture?: string | null;
  };
};

type ProjectSummaryBannerProps = {
  readonly project: Project;
  readonly canEditBranding?: boolean;
};

export function ProjectSummaryBanner({
  project: initialProject,
  canEditBranding = false,
}: Readonly<ProjectSummaryBannerProps>) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [coverDialogOpen, setCoverDialogOpen] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  const isActive = project.status === 'active';
  const hasTimeline = Boolean(project.start_date || project.end_date);
  const coverUrl = project.cover_picture ?? null;
  const logoUrl = project.logo_url ?? null;

  const uploadImage = async (
    kind: 'logo' | 'cover',
    file: File
  ): Promise<void> => {
    const isLogo = kind === 'logo';
    const setError = isLogo ? setLogoError : setCoverError;
    const setUploading = isLogo ? setIsUploadingLogo : setIsUploadingCover;
    const setDialogOpen = isLogo ? setLogoDialogOpen : setCoverDialogOpen;

    setUploading(true);
    setError(null);

    const outcome = await uploadLockedImage<ProjectImageUploadResult>({
      path: `/api/projects/${project.id}/${kind}`,
      file,
      expectedUpdatedAt: project.updated_at,
      conflictMessage:
        'Someone else updated this project. Refresh, then try again.',
      failureFallback: `Failed to upload project ${kind}.`,
    });

    applyLockedImageUploadOutcome(outcome, {
      onSuccess: (result) => {
        setProject((prev) => ({
          ...prev,
          updated_at: result.project.updated_at,
          ...(isLogo
            ? { logo_url: result.url }
            : { cover_picture: result.url }),
        }));
        setDialogOpen(false);
        router.refresh();
      },
      onConflictUpdatedAt: (nextUpdatedAt) => {
        setProject((prev) => ({ ...prev, updated_at: nextUpdatedAt }));
      },
      onFailure: setError,
    });

    setUploading(false);
  };

  return (
    <>
      <div
        className={cn(
          'border-primary/15 relative overflow-hidden rounded-2xl border',
          !coverUrl &&
            'from-primary/5 bg-linear-to-r via-transparent to-transparent'
        )}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- public Storage URL
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
        {coverUrl ? (
          <div
            className="from-background/95 via-background/80 to-background/40 absolute inset-0 bg-linear-to-r"
            aria-hidden
          />
        ) : null}

        <div className="relative flex flex-col gap-4 px-6 py-4 md:px-8 md:py-5">
          {canEditBranding ? (
            <div className="absolute end-3 top-3 z-10 flex flex-wrap gap-2 sm:end-4 sm:top-4">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="bg-background/90 hover:bg-background shadow-sm backdrop-blur-sm"
                onClick={() => {
                  setCoverError(null);
                  setCoverDialogOpen(true);
                }}
              >
                <ImagePlus data-icon="inline-start" />
                {coverUrl ? 'Change cover' : 'Add cover'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="bg-background/90 hover:bg-background shadow-sm backdrop-blur-sm"
                onClick={() => {
                  setLogoError(null);
                  setLogoDialogOpen(true);
                }}
              >
                <ImagePlus data-icon="inline-start" />
                {logoUrl ? 'Change logo' : 'Add logo'}
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-start gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- public Storage URL
              <img
                src={logoUrl}
                alt={`${project.name} logo`}
                className="border-border bg-background size-16 shrink-0 rounded-xl border object-cover shadow-sm md:size-20"
              />
            ) : (
              <div
                className="border-border bg-primary/10 text-primary flex size-16 shrink-0 items-center justify-center rounded-xl border text-lg font-bold md:size-20"
                aria-hidden
              >
                {project.key.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-3 pe-0 sm:pe-40">
              <div className="flex flex-wrap items-center gap-2">
                {isActive ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCircle className="mr-1 h-3.5 w-3.5 fill-current" />
                    Active
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 font-semibold text-amber-600 dark:text-amber-400"
                  >
                    <AlertCircle className="mr-1 h-3.5 w-3.5 fill-current" />
                    {project.status}
                  </Badge>
                )}
                <span className="bg-primary/10 text-primary border-primary/20 inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tracking-wide">
                  {project.key}
                </span>
              </div>

              <h1 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
                {project.name}
              </h1>

              {hasTimeline ? (
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatDate(project.start_date)} –{' '}
                      {formatDate(project.end_date)}
                    </span>
                  </div>
                </div>
              ) : null}

              <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
                {project.description ||
                  'No description provided for this project.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {canEditBranding ? (
        <>
          <ImagePositionUploadDialog
            open={coverDialogOpen}
            onOpenChange={setCoverDialogOpen}
            title="Project cover"
            description="Drop one image, then drag and zoom to frame the project banner. JPEG, PNG, WebP, or GIF up to 2 MB."
            aspect="cover"
            confirmLabel="Save cover"
            isUploading={isUploadingCover}
            error={coverError}
            onConfirm={(file) => uploadImage('cover', file)}
          />
          <ImagePositionUploadDialog
            open={logoDialogOpen}
            onOpenChange={setLogoDialogOpen}
            title="Project logo"
            description="Drop one image, then drag and zoom to frame the logo. JPEG, PNG, WebP, or GIF up to 2 MB."
            aspect="logo"
            confirmLabel="Save logo"
            isUploading={isUploadingLogo}
            error={logoError}
            onConfirm={(file) => uploadImage('logo', file)}
          />
        </>
      ) : null}
    </>
  );
}
