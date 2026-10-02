'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  Calendar,
  CheckCircle,
  AlertCircle,
  ImagePlus,
  PencilIcon,
  RefreshCw,
  Trash2,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { formatDate } from '@/app/_shared/utility';
import { ImagePositionUploadDialog } from '@/components/image-position-upload-dialog';
import { applyLockedImageUploadOutcome } from '@/lib/image-position/apply-locked-image-upload';
import { uploadLockedImage } from '@/lib/image-position/upload-locked-image';
import { UserAvatar } from '@/components/user-avatar';
import { useRealtime } from '@/components/realtime/realtime-provider';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import { DismissibleError } from '@/components/dismissible-error';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runRegistryLockedAction } from '@/lib/optimistic-lock/run-locked-mutation';
import { ProjectStatusEnum } from '@/app/projects/_helpers/project-status';
import {
  hardDeleteProject,
  restoreProject,
  type Project,
} from '@/app/projects/_services/projects.mutations.client';
import type { User } from '@/app/users/_services/users.mutations.client';
import { ProjectDetailsEditDialog } from '@/app/projects/_components/project-details/project-details-edit-dialog';

type BannerConfirmMode = 'restore' | 'purge';

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
  /** Managers/admins can edit active projects and restore archived ones. */
  readonly canEditDetails?: boolean;
  /** Admins can permanently purge archived projects. */
  readonly isAdmin?: boolean;
  readonly currentUserId?: string | null;
  readonly ownerOptions?: readonly User[];
};

type BannerActionFlags = {
  readonly showDetailsEdit: boolean;
  readonly showBranding: boolean;
  readonly showRestore: boolean;
  readonly showPurge: boolean;
  readonly showBannerActions: boolean;
};

const bannerActionButtonClassName =
  'bg-background/90 hover:bg-background shadow-sm backdrop-blur-sm';

function resolveBannerActionFlags(options: {
  readonly status: Project['status'];
  readonly canEditBranding: boolean;
  readonly canEditDetails: boolean;
  readonly isAdmin: boolean;
}): BannerActionFlags {
  const isActive = options.status === ProjectStatusEnum.active;
  const isArchived = options.status === ProjectStatusEnum.archived;
  const showDetailsEdit = options.canEditDetails && isActive;
  const showBranding = options.canEditBranding && isActive;
  const showRestore = options.canEditDetails && isArchived;
  const showPurge = options.isAdmin && isArchived;
  return {
    showDetailsEdit,
    showBranding,
    showRestore,
    showPurge,
    showBannerActions:
      showDetailsEdit || showBranding || showRestore || showPurge,
  };
}

function BannerActionButton({
  label,
  icon,
  onClick,
  disabled,
  destructive,
}: Readonly<{
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}>) {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={disabled}
      className={cn(
        bannerActionButtonClassName,
        destructive && 'text-destructive hover:text-destructive'
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </Button>
  );
}

function ProjectBannerActions({
  flags,
  coverUrl,
  logoUrl,
  isPending,
  onEdit,
  onRestore,
  onPurge,
  onChangeCover,
  onChangeLogo,
}: Readonly<{
  flags: BannerActionFlags;
  coverUrl: string | null;
  logoUrl: string | null;
  isPending: boolean;
  onEdit: () => void;
  onRestore: () => void;
  onPurge: () => void;
  onChangeCover: () => void;
  onChangeLogo: () => void;
}>) {
  if (!flags.showBannerActions) {
    return null;
  }

  return (
    <div className="absolute inset-e-3 top-3 z-10 flex flex-wrap gap-2 sm:inset-e-4 sm:top-4">
      {flags.showDetailsEdit ? (
        <BannerActionButton
          label="Edit"
          icon={<PencilIcon data-icon="inline-start" />}
          onClick={onEdit}
        />
      ) : null}
      {flags.showRestore ? (
        <BannerActionButton
          label="Restore"
          icon={<RefreshCw data-icon="inline-start" />}
          disabled={isPending}
          onClick={onRestore}
        />
      ) : null}
      {flags.showPurge ? (
        <BannerActionButton
          label="Purge"
          icon={<Trash2 data-icon="inline-start" />}
          disabled={isPending}
          destructive
          onClick={onPurge}
        />
      ) : null}
      {flags.showBranding ? (
        <>
          <BannerActionButton
            label={coverUrl ? 'Change cover' : 'Add cover'}
            icon={<ImagePlus data-icon="inline-start" />}
            onClick={onChangeCover}
          />
          <BannerActionButton
            label={logoUrl ? 'Change logo' : 'Add logo'}
            icon={<ImagePlus data-icon="inline-start" />}
            onClick={onChangeLogo}
          />
        </>
      ) : null}
    </div>
  );
}

function ProjectBannerIdentity({
  project,
  isActive,
  logoUrl,
}: Readonly<{
  project: Project;
  isActive: boolean;
  logoUrl: string | null;
}>) {
  const { isUserOnline } = useRealtime();
  const hasTimeline = Boolean(project.start_date || project.end_date);

  return (
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

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 shrink-0" />
            {hasTimeline ? (
              <span>
                {formatDate(project.start_date)} –{' '}
                {formatDate(project.end_date)}
              </span>
            ) : (
              <span>No timeline configured</span>
            )}
          </div>
        </div>

        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          {project.description || 'No description provided for this project.'}
        </p>

        <div className="flex max-w-xs items-center gap-2.5">
          <UserAvatar
            name={project.owner?.name}
            imageUrl={project.owner?.profile_picture}
            isOnline={Boolean(
              project.owner?.id && isUserOnline(project.owner.id)
            )}
            className="size-8 shrink-0"
            fallbackClassName="bg-primary/10 text-primary text-xs font-semibold"
          />
          <div className="min-w-0">
            <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-wider uppercase">
              Owner
            </p>
            <TruncatedText className="text-foreground text-sm font-semibold">
              {project.owner?.name ?? 'Unknown owner'}
            </TruncatedText>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectBannerDialogs({
  project,
  flags,
  ownerOptions,
  coverDialogOpen,
  logoDialogOpen,
  editDialogOpen,
  confirmMode,
  coverError,
  logoError,
  isUploadingCover,
  isUploadingLogo,
  isPending,
  onCoverOpenChange,
  onLogoOpenChange,
  onEditOpenChange,
  onConfirmModeChange,
  onUploadCover,
  onUploadLogo,
  onPatched,
  onConfirmRestore,
  onConfirmPurge,
}: Readonly<{
  project: Project;
  flags: BannerActionFlags;
  ownerOptions: readonly User[];
  coverDialogOpen: boolean;
  logoDialogOpen: boolean;
  editDialogOpen: boolean;
  confirmMode: BannerConfirmMode | null;
  coverError: string | null;
  logoError: string | null;
  isUploadingCover: boolean;
  isUploadingLogo: boolean;
  isPending: boolean;
  // eslint-disable-next-line no-unused-vars -- dialog open change
  onCoverOpenChange: (open: boolean) => void;
  // eslint-disable-next-line no-unused-vars -- dialog open change
  onLogoOpenChange: (open: boolean) => void;
  // eslint-disable-next-line no-unused-vars -- dialog open change
  onEditOpenChange: (open: boolean) => void;
  // eslint-disable-next-line no-unused-vars -- confirm mode clear
  onConfirmModeChange: (mode: BannerConfirmMode | null) => void;
  // eslint-disable-next-line no-unused-vars -- upload cover
  onUploadCover: (file: File) => Promise<void>;
  // eslint-disable-next-line no-unused-vars -- upload logo
  onUploadLogo: (file: File) => Promise<void>;
  // eslint-disable-next-line no-unused-vars -- patched project
  onPatched: (updated: Project) => void;
  onConfirmRestore: () => void;
  onConfirmPurge: () => void;
}>) {
  return (
    <>
      {flags.showBranding ? (
        <>
          <ImagePositionUploadDialog
            open={coverDialogOpen}
            onOpenChange={onCoverOpenChange}
            title="Project cover"
            description="Drop one image, then drag and zoom to frame the project banner. JPEG, PNG, WebP, or GIF up to 2 MB."
            aspect="cover"
            confirmLabel="Save cover"
            isUploading={isUploadingCover}
            error={coverError}
            onConfirm={onUploadCover}
          />
          <ImagePositionUploadDialog
            open={logoDialogOpen}
            onOpenChange={onLogoOpenChange}
            title="Project logo"
            description="Drop one image, then drag and zoom to frame the logo. JPEG, PNG, WebP, or GIF up to 2 MB."
            aspect="logo"
            confirmLabel="Save logo"
            isUploading={isUploadingLogo}
            error={logoError}
            onConfirm={onUploadLogo}
          />
        </>
      ) : null}

      {flags.showDetailsEdit ? (
        <ProjectDetailsEditDialog
          open={editDialogOpen}
          onOpenChange={onEditOpenChange}
          project={project}
          ownerOptions={ownerOptions}
          onPatched={onPatched}
        />
      ) : null}

      {confirmMode === 'restore' ? (
        <RegistryConfirmDialog
          title="Restore Project"
          subject={`${project.name} (${project.key})`}
          detail="It will return to the active projects list and become editable again."
          confirmLabel="Restore Project"
          pendingLabel="Restoring..."
          isPending={isPending}
          isSoft
          actionVerb="restore"
          onCancel={() => onConfirmModeChange(null)}
          onConfirm={onConfirmRestore}
        />
      ) : null}

      {confirmMode === 'purge' ? (
        <RegistryConfirmDialog
          title="Permanently Delete Project"
          subject={`${project.name} (${project.key})`}
          detail="Warning: This action is irreversible. All issues, sprints, and comments associated with this project will be permanently destroyed."
          confirmLabel="Delete Permanently"
          pendingLabel="Deleting..."
          isPending={isPending}
          isSoft={false}
          onCancel={() => onConfirmModeChange(null)}
          onConfirm={onConfirmPurge}
        />
      ) : null}
    </>
  );
}

export function ProjectSummaryBanner({
  project: initialProject,
  canEditBranding = false,
  canEditDetails = false,
  isAdmin = false,
  currentUserId = null,
  ownerOptions = [],
}: Readonly<ProjectSummaryBannerProps>) {
  const router = useRouter();
  const { handleMutationError } = useOptimisticLock();
  const [project, setProject] = useState(initialProject);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [coverDialogOpen, setCoverDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<BannerConfirmMode | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  const isActive = project.status === ProjectStatusEnum.active;
  const coverUrl = project.cover_picture ?? null;
  const logoUrl = project.logo_url ?? null;
  const flags = resolveBannerActionFlags({
    status: project.status,
    canEditBranding,
    canEditDetails,
    isAdmin,
  });

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

  const confirmRestore = () => {
    setActionError(null);
    startTransition(async () => {
      const ok = await runRegistryLockedAction({
        mutate: () => restoreProject(project.id, project.updated_at),
        handleMutationError,
        entityType: 'project',
        entityId: project.id,
        expectedUpdatedAt: project.updated_at,
        pendingFields: { status: ProjectStatusEnum.active },
        currentUserId,
        failureFallback: 'Failed to restore project.',
        onError: setActionError,
        onSuccess: () => {
          setConfirmMode(null);
          router.refresh();
        },
      });
      if (!ok) {
        setConfirmMode(null);
      }
    });
  };

  const confirmPurge = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        await hardDeleteProject(project.id);
        setConfirmMode(null);
        router.push('/projects?tab=archived');
        router.refresh();
      } catch (err) {
        setActionError(
          err instanceof Error
            ? err.message
            : 'Failed to permanently delete project.'
        );
        setConfirmMode(null);
      }
    });
  };

  return (
    <>
      <DismissibleError
        message={actionError}
        onDismiss={() => setActionError(null)}
      />

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
          <ProjectBannerActions
            flags={flags}
            coverUrl={coverUrl}
            logoUrl={logoUrl}
            isPending={isPending}
            onEdit={() => setEditDialogOpen(true)}
            onRestore={() => {
              setActionError(null);
              setConfirmMode('restore');
            }}
            onPurge={() => {
              setActionError(null);
              setConfirmMode('purge');
            }}
            onChangeCover={() => {
              setCoverError(null);
              setCoverDialogOpen(true);
            }}
            onChangeLogo={() => {
              setLogoError(null);
              setLogoDialogOpen(true);
            }}
          />
          <ProjectBannerIdentity
            project={project}
            isActive={isActive}
            logoUrl={logoUrl}
          />
        </div>
      </div>

      <ProjectBannerDialogs
        project={project}
        flags={flags}
        ownerOptions={ownerOptions}
        coverDialogOpen={coverDialogOpen}
        logoDialogOpen={logoDialogOpen}
        editDialogOpen={editDialogOpen}
        confirmMode={confirmMode}
        coverError={coverError}
        logoError={logoError}
        isUploadingCover={isUploadingCover}
        isUploadingLogo={isUploadingLogo}
        isPending={isPending}
        onCoverOpenChange={setCoverDialogOpen}
        onLogoOpenChange={setLogoDialogOpen}
        onEditOpenChange={setEditDialogOpen}
        onConfirmModeChange={setConfirmMode}
        onUploadCover={(file) => uploadImage('cover', file)}
        onUploadLogo={(file) => uploadImage('logo', file)}
        onPatched={(updated) => {
          setProject(updated);
          router.refresh();
        }}
        onConfirmRestore={confirmRestore}
        onConfirmPurge={confirmPurge}
      />
    </>
  );
}
