'use client';

import { FormAlertMessage } from '@/app/_shared/form-alert-message';
import { FormEvent, useEffect, useState, type ChangeEvent } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  UserPlus,
  Loader2,
  X,
} from '@repo/ui/lib/icons';
import type { User } from '../_services/users.service';
import { createUser, updateUser } from '../_services/users.service';

interface UserFormProps {
  readonly user?: User;
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
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
          process.env.NEXT_PUBLIC_SITE_URL || globalThis.location.origin;
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-muted-foreground absolute top-4 right-4 h-8 w-8 cursor-pointer rounded-full transition-colors"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </Button>
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
              <Select
                value={role}
                onValueChange={(val) =>
                  setRole(val as 'admin' | 'manager' | 'member')
                }
              >
                <SelectTrigger id="role" className="bg-background/80 h-10">
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <FormAlertMessage message={message} isError={isError} />

          <div className="flex gap-3 pt-2">
            {onClose && (
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || isSuccess}
                onClick={onClose}
                className="w-1/3"
              >
                Cancel
              </Button>
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
