'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@repo/ui/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { toast } from '@repo/ui/components/ui/sonner';
import { Loader2, UserPlus } from '@repo/ui/lib/icons';
import {
  createUser,
  type User,
} from '@/app/users/_services/users.mutations.client';
import { invalidateUserDropdownCache } from '@/app/users/_services/users.cache.actions.server';
import { resolveUserByEmail } from '@/app/users/_services/users.lookup.actions.server';
import { afterDialogClose } from '@/lib/dialog-close';
import { preventDismissForFloatingPortal } from '@/lib/dialog-outside-events';
import { isProductUsableUser } from '@repo/types';

type QuickCreateRole = 'manager' | 'member';

const PENDING_INVITE_MESSAGE =
  'This email is already invited, but they have not finished signup yet. They need to complete the invite before you can add them here.';

type ProjectFormQuickCreateUserProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  // eslint-disable-next-line no-unused-vars -- callback docs
  readonly onCreated: (user: User) => void;
};

export function ProjectFormQuickCreateUser({
  open,
  onClose,
  onCreated,
}: Readonly<ProjectFormQuickCreateUserProps>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<QuickCreateRole>('manager');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (open) {
      return;
    }
    return afterDialogClose(() => {
      setName('');
      setEmail('');
      setRole('manager');
      setError(null);
      setIsPending(false);
    });
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next && !isPending) {
      onClose();
    }
  };

  const invalidateDropdown = () => {
    invalidateUserDropdownCache().catch((cacheError: unknown) => {
      console.warn(
        'warn. failed to invalidate user dropdown cache after quick create:',
        cacheError
      );
    });
  };

  /** Verified users only — pending invitees cannot be project members/owners. */
  const finishWithVerifiedUser = (user: User) => {
    invalidateDropdown();
    onCreated(user);
    onClose();
    toast.success('Existing user selected.', {
      description: `${user.name} is already in Alice and was added to the members list.`,
    });
  };

  /** New invite: mail went out; they stay off the members list until signup. */
  const finishInviteSent = (invitedName: string) => {
    invalidateDropdown();
    onClose();
    toast.success('Invitation sent.', {
      description: `${invitedName} must finish signup before you can add them as a member or owner. Ask them to check spam if the email is missing.`,
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      setError('Name and email are required.');
      return;
    }

    setIsPending(true);
    setError(null);

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || globalThis.location.origin;
    const redirectToUrl = `${origin.replace(/\/$/, '')}/auth/callback?next=${encodeURIComponent('/reset-password')}`;

    resolveUserByEmail(trimmedEmail)
      .then((existing) => {
        if (existing) {
          if (!isProductUsableUser(existing)) {
            setError(PENDING_INVITE_MESSAGE);
            setIsPending(false);
            return;
          }
          finishWithVerifiedUser(existing);
          return;
        }

        return createUser({
          name: trimmedName,
          email: trimmedEmail,
          role,
          redirectTo: redirectToUrl,
        }).then((user) => {
          finishInviteSent(user.name);
        });
      })
      .catch((createError: unknown) => {
        const message =
          createError instanceof Error
            ? createError.message
            : 'Failed to create user.';
        // Race: another create landed between lookup and insert.
        if (/already exists/i.test(message)) {
          resolveUserByEmail(trimmedEmail)
            .then((existing) => {
              if (existing && isProductUsableUser(existing)) {
                finishWithVerifiedUser(existing);
                return;
              }
              setError(existing ? PENDING_INVITE_MESSAGE : message);
              setIsPending(false);
            })
            .catch(() => {
              setError(message);
              setIsPending(false);
            });
          return;
        }
        setError(message);
        setIsPending(false);
      });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={preventDismissForFloatingPortal}
        onInteractOutside={preventDismissForFloatingPortal}
        onFocusOutside={preventDismissForFloatingPortal}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Quick create user
          </DialogTitle>
          <DialogDescription>
            Invite a new Manager or Member (they appear here after signup), or
            enter an existing verified user email to select them now. Pending
            invitees cannot be project owners yet.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="quick-create-name">Name</Label>
            <Input
              id="quick-create-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Full name"
              disabled={isPending}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-create-email">Email</Label>
            <Input
              id="quick-create-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              disabled={isPending}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-create-role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as QuickCreateRole)}
              disabled={isPending}
            >
              <SelectTrigger id="quick-create-role" className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Role applies only when creating a new user.
            </p>
          </div>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Working…
                </>
              ) : (
                'Add user'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
