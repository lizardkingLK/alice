'use client';

import Link from 'next/link';
import { BadgeCheck, ChevronLeft, Pencil } from '@repo/ui/lib/icons';
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
import {
  BIO_MAX_LENGTH,
  EDIT_PROFILE_MOCK,
} from '@/app/edit-profile/_components/edit-profile-mock-data';

const NOTIFICATION_ROWS = [
  {
    id: 'notif-product-updates',
    title: 'Product updates',
    description: 'News about new features and improvements.',
    defaultChecked: EDIT_PROFILE_MOCK.notifications.productUpdates,
  },
  {
    id: 'notif-mentions',
    title: 'Mentions & assignments',
    description: 'When someone mentions you or assigns you a work item.',
    defaultChecked: EDIT_PROFILE_MOCK.notifications.mentions,
  },
  {
    id: 'notif-weekly-summary',
    title: 'Weekly summary',
    description: 'A digest of your team activity every Monday.',
    defaultChecked: EDIT_PROFILE_MOCK.notifications.weeklySummary,
  },
] as const;

/**
 * Visual mock of the account settings surface. Fields are uncontrolled with
 * placeholder defaults; no handlers persist anything (scaffold only).
 */
export function EditProfileView() {
  const profile = EDIT_PROFILE_MOCK;

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
            Update your account details, security, and preferences.
          </p>
        </div>

        <div className="space-y-6 pb-24">
          {/* Profile photo */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Profile photo</CardTitle>
              <CardDescription>
                Upload a picture to personalize your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <div className="group relative size-32 rounded-full">
                <Avatar className="size-32">
                  {profile.avatarUrl ? (
                    <AvatarImage src={profile.avatarUrl} alt={profile.name} />
                  ) : null}
                  <AvatarFallback className="text-3xl font-semibold">
                    {getInitials(profile.name)}
                  </AvatarFallback>
                </Avatar>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Change photo"
                      className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity outline-none group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Pencil className="size-6" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Change photo</TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>

          {/* Public profile */}
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
                  defaultValue={profile.name}
                  placeholder="Your name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="handle">Username</Label>
                <Input
                  id="handle"
                  name="handle"
                  defaultValue={`@${profile.handle}`}
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
                  defaultValue={profile.bio}
                  placeholder="A short description about you"
                />
                <p className="text-muted-foreground text-xs">
                  Up to {BIO_MAX_LENGTH} characters.
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Role</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {profile.role}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    Managed by administrators.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact & account */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Contact & account</CardTitle>
              <CardDescription>Manage how we reach you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={profile.email}
                    className="sm:flex-1"
                  />
                  {profile.emailVerified ? (
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
                  Changing your email requires re-verification.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={profile.phone}
                  placeholder="Add a phone number"
                />
                <p className="text-muted-foreground text-xs">Optional.</p>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>
                Update your password and active sessions.
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
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div>
                <Button type="button" variant="outline" size="sm">
                  Update password
                </Button>
              </div>

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
                >
                  Sign out of all sessions
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Choose what we email you about.</CardDescription>
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
                  <Switch id={row.id} defaultChecked={row.defaultChecked} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-destructive/30 shadow-none">
            <CardHeader>
              <CardTitle className="text-destructive">Danger zone</CardTitle>
              <CardDescription>
                Irreversible and destructive actions.
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
              >
                Deactivate account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="bg-background/80 sticky bottom-0 z-10 border-t backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <Button asChild variant="outline">
            <Link href="/profile">Cancel</Link>
          </Button>
          <Button type="button">Save changes</Button>
        </div>
      </div>
    </div>
  );
}
