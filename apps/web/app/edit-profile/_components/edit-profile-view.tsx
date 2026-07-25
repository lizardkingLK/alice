'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type ChangeEvent } from 'react';
import { BadgeCheck, ChevronLeft, Loader2, Pencil } from '@repo/ui/lib/icons';
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
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Separator } from '@repo/ui/components/ui/separator';
import { Switch } from '@repo/ui/components/ui/switch';
import { Textarea } from '@repo/ui/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { getInitials } from '@/app/_shared/utility';
import { FormStatusAlerts } from '@/app/work-items/_components/workItem-form-alerts';
import { BIO_MAX_LENGTH } from '@/app/edit-profile/_components/edit-profile-constants';
import { apiFetch } from '@/lib/api/api-client';

const MAX_PROFILE_PICTURE_BYTES = 2 * 1024 * 1024;

const NOTIFICATION_ROWS = [
  {
    id: 'notif-product-updates',
    title: 'Product updates',
    description: 'News about new features and improvements.',
    defaultChecked: true,
  },
  {
    id: 'notif-mentions',
    title: 'Mentions & assignments',
    description: 'When someone mentions you or assigns you a work item.',
    defaultChecked: true,
  },
  {
    id: 'notif-weekly-summary',
    title: 'Weekly summary',
    description: 'A digest of your team activity every Monday.',
    defaultChecked: false,
  },
] as const;

export type EditProfileViewProps = {
  name: string;
  handle: string;
  email: string;
  emailVerified: boolean;
  role: string;
  avatarUrl: string | null;
};

type ProfilePictureUploadResult = {
  success: boolean;
  url: string;
  path: string;
};

type ProfileUpdateResult = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    profile_picture: string | null;
  };
};

/**
 * Self-service account settings. Photo + name persist to `public.users`.
 * Security, notifications, phone, bio, and danger zone remain deferred UI.
 */
export function EditProfileView({
  name: initialName,
  handle,
  email,
  emailVerified,
  role,
  avatarUrl: initialAvatarUrl,
}: Readonly<EditProfileViewProps>) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSavingName, startSaveName] = useTransition();
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (file.size > MAX_PROFILE_PICTURE_BYTES) {
      setSuccess(null);
      setError('Profile picture must be 2 MB or smaller.');
      return;
    }

    setIsUploadingPhoto(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiFetch<ProfilePictureUploadResult>(
        '/api/profile',
        {
          method: 'POST',
          body: formData,
        }
      );
      setAvatarUrl(result.url);
      setSuccess('Profile picture updated.');
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Failed to upload profile picture.'
      );
    } finally {
      setIsUploadingPhoto(false);
    }
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
          body: JSON.stringify({ name: trimmed }),
        });
        setName(trimmed);
        setSuccess('Profile saved.');
        router.refresh();
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : 'Failed to save profile.'
        );
      }
    });
  };

  const isBusy = isSavingName || isUploadingPhoto;

  return (
    <div className="bg-background min-h-full">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 space-y-1">
          <Link
            href="/profile"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ChevronLeft className="size-4" />
            Back to profile
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit profile
          </h1>
          <p className="text-muted-foreground text-sm">
            Update your photo and display name. Other preferences are coming
            soon.
          </p>
        </div>

        {error || success ? (
          <div className="mb-6">
            <FormStatusAlerts error={error} success={success} />
          </div>
        ) : null}

        <div className="space-y-6 pb-24">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Profile photo</CardTitle>
              <CardDescription>
                Upload a picture to personalize your account (JPEG, PNG, WebP,
                or GIF, up to 2 MB).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <div className="group relative size-32 rounded-full">
                <Avatar className="size-32">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={name} />
                  ) : null}
                  <AvatarFallback className="text-3xl font-semibold">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={handlePhotoSelected}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Change photo"
                      disabled={isBusy}
                      onClick={openFilePicker}
                      className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity outline-none group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUploadingPhoto ? (
                        <Loader2 className="size-6 animate-spin" />
                      ) : (
                        <Pencil className="size-6" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Change photo</TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Public profile</CardTitle>
              <CardDescription>
                This information may be visible to your team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  disabled={isBusy}
                  maxLength={100}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="handle">Username</Label>
                <Input
                  id="handle"
                  name="handle"
                  value={`@${handle}`}
                  readOnly
                  className="bg-muted/40"
                />
                <p className="text-muted-foreground text-xs">
                  Your username is derived from your email and can&apos;t be
                  changed here.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  rows={3}
                  maxLength={BIO_MAX_LENGTH}
                  disabled
                  placeholder="Coming soon"
                />
                <p className="text-muted-foreground text-xs">
                  Bio is not stored yet — coming in a later release.
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Role</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {role}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    Managed by administrators.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Contact & account</CardTitle>
              <CardDescription>How we reach you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    readOnly
                    className="bg-muted/40 sm:flex-1"
                  />
                  {emailVerified ? (
                    <Badge
                      variant="outline"
                      className="w-fit gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    >
                      <BadgeCheck className="size-3.5" />
                      Verified
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  Email changes are not available here yet.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  disabled
                  placeholder="Coming soon"
                />
                <p className="text-muted-foreground text-xs">
                  Phone is not stored yet — coming in a later release.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>
                Password and session controls (coming soon).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  name="current-password"
                  type="password"
                  autoComplete="current-password"
                  disabled
                  placeholder="••••••••"
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    name="new-password"
                    type="password"
                    autoComplete="new-password"
                    disabled
                    placeholder="••••••••"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    disabled
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" disabled>
                Update password
              </Button>

              <Separator />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Sign out everywhere</p>
                  <p className="text-muted-foreground text-xs">
                    End all other active sessions on other devices.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled
                >
                  Sign out of all sessions
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Email preferences (coming soon).
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-border divide-y">
              {NOTIFICATION_ROWS.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-0.5">
                    <Label htmlFor={row.id} className="text-sm font-medium">
                      {row.title}
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      {row.description}
                    </p>
                  </div>
                  <Switch
                    id={row.id}
                    defaultChecked={row.defaultChecked}
                    disabled
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-destructive/30 shadow-none">
            <CardHeader>
              <CardTitle className="text-destructive">Danger zone</CardTitle>
              <CardDescription>
                Irreversible actions (coming soon).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Deactivate account</p>
                <p className="text-muted-foreground text-xs">
                  Disable your account and revoke access. This can be undone by
                  an administrator.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled
              >
                Deactivate account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="bg-background/80 sticky bottom-0 z-10 border-t backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <Button asChild variant="outline">
            <Link href="/profile">Cancel</Link>
          </Button>
          <Button type="button" onClick={handleSaveName} disabled={isBusy}>
            {isSavingName ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
