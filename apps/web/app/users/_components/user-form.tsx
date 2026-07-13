'use client';

import { FormEvent, useEffect, useState, type ChangeEvent } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { UserPlus, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';
import type { User } from '../_services/users.service';
import { createUser, updateUser } from '../_services/users.service';
import { cn } from '@repo/ui/lib/utils';

interface UserFormProps {
  readonly user?: User;
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
}

interface FormAlertMessageProps {
  message: string | null;
  isError: boolean;
}

function FormAlertMessage({
  message,
  isError,
}: Readonly<FormAlertMessageProps>) {
  if (!message) return null;
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border p-3 text-sm',
        isError
          ? 'text-destructive bg-destructive/10 border-destructive/20'
          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
      )}
    >
      {isError ? (
        <AlertCircle className="h-4 w-4 shrink-0" />
      ) : (
        <CheckCircle className="h-4 w-4 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

export function UserForm({
  user,
  onClose,
  onSuccess,
}: Readonly<UserFormProps>) {
  const isEdit = !!user;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<'admin' | 'manager' | 'member'>(
    user?.role ?? 'member'
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    if (!name.trim() || (!isEdit && !email.trim()) || !role) {
      setMessage('Name, email, and role are required.');
      setIsError(true);
      setIsSubmitting(false);
      return;
    }

    try {
      if (isEdit) {
        await updateUser(user.id, {
          name: name.trim(),
          role,
        });
        setMessage(`User details updated successfully!`);
      } else {
        const origin =
          process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        const redirectToUrl = `${origin.replace(/\/$/, '')}/auth/callback?next=${encodeURIComponent('/reset-password')}`;

        await createUser({
          name: name.trim(),
          email: email.trim(),
          role,
          redirectTo: redirectToUrl,
        });
        setMessage(`User added successfully! Sending invitation...`);
      }

      setIsSuccess(true);
    } catch (error) {
      const modeText = isEdit ? 'update' : 'add';
      const errorMessage =
        error instanceof Error ? error.message : `Failed to ${modeText} user.`;
      setMessage(errorMessage);
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        onSuccess?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onSuccess]);

  let submitButtonText;
  if (isSubmitting) {
    submitButtonText = (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {isEdit ? 'Saving Changes...' : 'Adding User...'}
      </>
    );
  } else if (isEdit) {
    submitButtonText = 'Save Changes';
  } else {
    submitButtonText = 'Add User';
  }

  return (
    <Card className="relative border border-gray-200 bg-white text-gray-900 shadow-xl transition-all duration-300 hover:shadow-2xl">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="hover:bg-muted text-muted-foreground hover:text-foreground absolute top-4 right-4 cursor-pointer rounded-full p-1.5 transition-colors"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <CardHeader className="space-y-1.5 pb-4">
        <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <UserPlus className="text-primary h-5 w-5 animate-pulse" />
          {isEdit ? 'Edit User Details' : 'Add New User'}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          {isEdit
            ? "Update team member's workspace role and profile details."
            : 'Register a new team member and assign them a workspace role.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Full Name
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="Erlich Bachman"
              required
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="erlich@bachmanity.com"
              required={!isEdit}
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              disabled={isEdit}
              className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="text-sm font-medium">
              Workspace Role
            </Label>
            <div className="relative">
              <select
                id="role"
                name="role"
                required
                value={role}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setRole(e.target.value as 'admin' | 'manager' | 'member')
                }
                className="bg-background/80 border-input text-foreground focus:border-primary focus:ring-primary ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <option value="member">Member</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <FormAlertMessage message={message} isError={isError} />

          <div className="flex gap-3 pt-2">
            {onClose && (
              <button
                type="button"
                disabled={isSubmitting || isSuccess}
                onClick={onClose}
                className="border-input bg-background hover:bg-accent text-foreground flex w-1/3 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold shadow-sm transition-all duration-300"
              >
                Cancel
              </button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || isSuccess}
              className={`${onClose ? 'w-2/3' : 'w-full'}`}
            >
              {submitButtonText}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
