'use client';

import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Shield,
  SlidersHorizontal,
  UserRound,
} from '@repo/ui/lib/icons';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { formatLabelFirstLetterCapitalized } from '@/app/_shared/utility';
import {
  deactivateMyAccount,
  type DeactivateAccountState,
} from '@/app/edit-profile/_components/actions';
import { EditProfilePreferencesCard } from '@/app/edit-profile/_components/edit-profile-preferences-card';
import { ImagePositionUploadDialog } from '@/components/image-position-upload-dialog';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { applyLockedImageUploadOutcome } from '@/lib/image-position/apply-locked-image-upload';
import { uploadLockedImage } from '@/lib/image-position/upload-locked-image';
import { tryHandleLockedMutationError } from '@/lib/optimistic-lock/run-locked-mutation';
import type { AccountSettingsTab } from '@/lib/search-params';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Separator } from '@repo/ui/components/ui/separator';
import { Switch } from '@repo/ui/components/ui/switch';
import { FormStatusAlerts } from '@/app/work-items/_components/work-item-form/work-item-form-alerts';

type EditProfileViewProps = {
  readonly section: AccountSettingsTab;
  readonly name: string;
  readonly handle: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly role: string;
  readonly avatarUrl: string | null;
  readonly userId: string;
  readonly updatedAt: string;
};

type ProfileUpdateResult = {
  readonly id: string;
  readonly name: string;
};

type ProfilePictureUploadResult = {
  readonly url: string;
};

const SECTION_HEADINGS: Record<
  AccountSettingsTab,
  { readonly title: string; readonly icon: typeof UserRound }
> = {
  general: { title: 'General', icon: UserRound },
  security: { title: 'Security', icon: Shield },
  notifications: { title: 'Notifications', icon: Bell },
  preferences: { title: 'Preferences', icon: SlidersHorizontal },
};

/**
 * Self-service account settings, split by settings tab section.
 */
export function EditProfileView({
  section,
  name: initialName,
  handle,
  email,
  emailVerified,
  role,
  avatarUrl: initialAvatarUrl,
  userId,
  updatedAt: initialUpdatedAt,
}: Readonly<EditProfileViewProps>) {
  const router = useRouter();
  const { handleMutationError } = useOptimisticLock();
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSavingName, startSaveName] = useTransition();
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deactivateState, deactivateAction, isDeactivating] = useActionState<
    DeactivateAccountState | null,
    FormData
  >(deactivateMyAccount, null);

  useEffect(() => {
    if (deactivateState?.error) {
      setError(deactivateState.error);
    }
  }, [deactivateState]);

  const handlePhotoConfirm = async (file: File) => {
    setIsUploadingPhoto(true);
    setPhotoError(null);
    setError(null);
    setSuccess(null);

    const outcome = await uploadLockedImage<ProfilePictureUploadResult>({
      path: '/api/profile',
      file,
      expectedUpdatedAt: updatedAt,
      conflictMessage:
        'Someone else updated your profile. Refresh, then upload your photo again.',
      failureFallback: 'Failed to upload profile picture.',
    });

    applyLockedImageUploadOutcome(outcome, {
      onSuccess: (result) => {
        setAvatarUrl(result.url);
        setUpdatedAt(new Date().toISOString());
        setSuccess('Profile picture updated.');
        setPhotoDialogOpen(false);
        router.refresh();
      },
      onConflictUpdatedAt: setUpdatedAt,
      onFailure: setPhotoError,
    });

    setIsUploadingPhoto(false);
  };

  const handleSaveName = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setSuccess(null);
      setError('Name must be at least 2 characters.');
      return;
    }

    startSaveName(async () => {
      setError(null);
      setSuccess(null);
      try {
        await apiFetch<ProfileUpdateResult>('/api/profile', {
          method: 'PATCH',
          body: JSON.stringify({ name: trimmed, expectedUpdatedAt: updatedAt }),
        });
        setName(trimmed);
        setUpdatedAt(new Date().toISOString());
        setSuccess('Profile saved.');
        router.refresh();
      } catch (saveError) {
        if (
          await tryHandleLockedMutationError({
            error: saveError,
            handleMutationError,
            entityType: 'user',
            entityId: userId,
            expectedUpdatedAt: updatedAt,
            pendingFields: { name: trimmed },
            currentUserId: userId,
          })
        ) {
          return;
        }
        setError(
          saveError instanceof Error
            ? saveError.message
            : 'Failed to save profile.'
        );
      }
    });
  };

  const isBusy = isSavingName || isUploadingPhoto || isDeactivating;
  const confirmationMatches =
    confirmation.trim().toLowerCase() === email.trim().toLowerCase();
  const heading = SECTION_HEADINGS[section];
  const HeadingIcon = heading.icon;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <HeadingIcon
            className="text-muted-foreground size-5"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            {heading.title}
          </h1>
        </div>

        {error || success ? (
          <FormStatusAlerts error={error} success={success} />
        ) : null}

        {section === 'general' ? (
          <GeneralSection
            name={name}
            handle={handle}
            email={email}
            emailVerified={emailVerified}
            role={role}
            avatarUrl={avatarUrl}
            isBusy={isBusy}
            isUploadingPhoto={isUploadingPhoto}
            photoDialogOpen={photoDialogOpen}
            photoError={photoError}
            onNameChange={setName}
            onPhotoDialogOpenChange={(open) => {
              setPhotoDialogOpen(open);
              if (!open) {
                setPhotoError(null);
              }
            }}
            onPhotoConfirm={handlePhotoConfirm}
          />
        ) : null}

        {section === 'security' ? (
          <SecuritySection
            email={email}
            updatedAt={updatedAt}
            confirmation={confirmation}
            confirmationMatches={confirmationMatches}
            deactivateOpen={deactivateOpen}
            deactivateState={deactivateState}
            isBusy={isBusy}
            isDeactivating={isDeactivating}
            onConfirmationChange={setConfirmation}
            onDeactivateOpenChange={(open) => {
              setDeactivateOpen(open);
              if (!open) {
                setConfirmation('');
              }
            }}
            deactivateAction={deactivateAction}
          />
        ) : null}

        {section === 'notifications' ? <NotificationsSection /> : null}

        {section === 'preferences' ? <PreferencesSection /> : null}
      </div>

      {section === 'general' ? (
        <div className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-0 z-10 border-t backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-3 px-4 py-4 sm:px-6 lg:px-8">
            <Button
              type="button"
              onClick={handleSaveName}
              disabled={isBusy || name.trim() === initialName.trim()}
            >
              {isSavingName ? (
                <>
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* eslint-disable no-unused-vars */
type GeneralSectionProps = {
  readonly name: string;
  readonly handle: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly role: string;
  readonly avatarUrl: string | null;
  readonly isBusy: boolean;
  readonly isUploadingPhoto: boolean;
  readonly photoDialogOpen: boolean;
  readonly photoError: string | null;
  readonly onNameChange: (value: string) => void;
  readonly onPhotoDialogOpenChange: (open: boolean) => void;
  readonly onPhotoConfirm: (file: File) => Promise<void>;
};

function GeneralSection({
  name,
  handle,
  email,
  emailVerified,
  role,
  avatarUrl,
  isBusy,
  isUploadingPhoto,
  photoDialogOpen,
  photoError,
  onNameChange,
  onPhotoDialogOpenChange,
  onPhotoConfirm,
}: Readonly<GeneralSectionProps>) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photo</CardTitle>
          <CardDescription>
            Shown on your profile and across Alice.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar className="size-20 border">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={`${name} avatar`} />
            ) : null}
            <AvatarFallback className="text-lg">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => onPhotoDialogOpenChange(true)}
            >
              {isUploadingPhoto ? (
                <>
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Camera data-icon="inline-start" />
                  Change photo
                </>
              )}
            </Button>
            <p className="text-muted-foreground text-xs">
              JPEG, PNG, WebP, or GIF · max 2 MB · square crop
            </p>
          </div>
        </CardContent>
      </Card>

      <ImagePositionUploadDialog
        open={photoDialogOpen}
        onOpenChange={onPhotoDialogOpenChange}
        title="Update profile photo"
        description="Drop an image, then drag and zoom to frame a square crop."
        aspect="avatar"
        confirmLabel="Upload photo"
        isUploading={isUploadingPhoto}
        error={photoError}
        onConfirm={onPhotoConfirm}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public profile</CardTitle>
          <CardDescription>
            How you appear to teammates on Alice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-profile-name">Display name</Label>
            <Input
              id="edit-profile-name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              disabled={isBusy}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-profile-handle">Handle</Label>
            <Input id="edit-profile-handle" value={handle} disabled readOnly />
            <p className="text-muted-foreground text-xs">
              Derived from your email. Changing handles is not available yet.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact & account</CardTitle>
          <CardDescription>
            Sign-in identity and workspace role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-profile-email">Email</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="edit-profile-email"
                value={email}
                disabled
                readOnly
                className="max-w-md"
              />
              {emailVerified ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="size-3" aria-hidden="true" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="outline">Unverified</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Email changes require a verification flow (coming soon).
            </p>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <div>
              <Badge variant="outline" className="capitalize">
                {formatLabelFirstLetterCapitalized(role)}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              Roles are managed by workspace admins.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

type SecuritySectionProps = {
  readonly email: string;
  readonly updatedAt: string;
  readonly confirmation: string;
  readonly confirmationMatches: boolean;
  readonly deactivateOpen: boolean;
  readonly deactivateState: DeactivateAccountState | null;
  readonly isBusy: boolean;
  readonly isDeactivating: boolean;
  readonly onConfirmationChange: (value: string) => void;
  readonly onDeactivateOpenChange: (open: boolean) => void;
  readonly deactivateAction: (payload: FormData) => void;
};

function SecuritySection({
  email,
  updatedAt,
  confirmation,
  confirmationMatches,
  deactivateOpen,
  deactivateState,
  isBusy,
  isDeactivating,
  onConfirmationChange,
  onDeactivateOpenChange,
  deactivateAction,
}: Readonly<SecuritySectionProps>) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4" aria-hidden="true" />
            Security
          </CardTitle>
          <CardDescription>
            Password and session controls for your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Password</p>
              <p className="text-muted-foreground text-xs">
                Change your sign-in password.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" disabled>
              Coming soon
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Active sessions</p>
              <p className="text-muted-foreground text-xs">
                Sign out other devices remotely.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" disabled>
              Coming soon
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2 text-base">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Danger zone
          </CardTitle>
          <CardDescription>
            Deactivating signs you out and blocks further sign-in until an admin
            restores your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="destructive"
            disabled={isBusy}
            onClick={() => onDeactivateOpenChange(true)}
          >
            Deactivate account
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={deactivateOpen}
        onOpenChange={(open) => {
          if (!isDeactivating) {
            onDeactivateOpenChange(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate your account?</DialogTitle>
            <DialogDescription>
              You will be signed out immediately and will not be able to sign in
              until an administrator reactivates you. Type your email{' '}
              <span className="text-foreground font-medium">{email}</span> to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <form action={deactivateAction} className="space-y-4">
            <input type="hidden" name="expectedUpdatedAt" value={updatedAt} />
            {deactivateState?.error ? (
              <p className="text-destructive text-sm" role="alert">
                {deactivateState.error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="deactivate-confirm-email">
                Type your email to confirm
              </Label>
              <Input
                id="deactivate-confirm-email"
                name="confirmation"
                type="email"
                value={confirmation}
                onChange={(event) => onConfirmationChange(event.target.value)}
                placeholder={email}
                autoComplete="off"
                disabled={isDeactivating}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isDeactivating}
                onClick={() => onDeactivateOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isDeactivating || !confirmationMatches}
              >
                {isDeactivating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Deactivating…
                  </>
                ) : (
                  'Deactivate account'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NotificationsSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4" aria-hidden="true" />
          Notifications
        </CardTitle>
        <CardDescription>Choose what Alice emails you about.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="notify-assignments" className="text-sm font-medium">
              Assignments
            </Label>
            <p className="text-muted-foreground text-xs">
              When someone assigns you a work item.
            </p>
          </div>
          <Switch id="notify-assignments" disabled aria-label="Assignments" />
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="notify-mentions" className="text-sm font-medium">
              Mentions & comments
            </Label>
            <p className="text-muted-foreground text-xs">
              When you are @mentioned or receive a comment reply.
            </p>
          </div>
          <Switch id="notify-mentions" disabled aria-label="Mentions" />
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="notify-digest" className="text-sm font-medium">
              Weekly digest
            </Label>
            <p className="text-muted-foreground text-xs">
              Summary of activity on projects you follow.
            </p>
          </div>
          <Switch id="notify-digest" disabled aria-label="Weekly digest" />
        </div>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Mail className="size-3.5 shrink-0" aria-hidden="true" />
          Notification preferences will sync when email delivery is enabled.
        </p>
      </CardContent>
    </Card>
  );
}

function PreferencesSection() {
  return <EditProfilePreferencesCard />;
}
