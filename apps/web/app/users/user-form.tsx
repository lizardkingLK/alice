'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { createUser, ActionState } from './actions';
import { UserPlus, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';

const initialState: ActionState = {
  success: false,
  error: null,
};

interface UserFormProps {
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
}

export function UserForm({ onClose, onSuccess }: Readonly<UserFormProps>) {
  const [state, formAction, isPending] = useActionState(createUser, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      const timer = setTimeout(() => {
        onSuccess?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.success, onSuccess]);

  return (
    <Card className="relative border border-gray-200 bg-white text-gray-900 shadow-xl transition-all duration-300 hover:shadow-2xl">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <CardHeader className="space-y-1.5 pb-4">
        <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <UserPlus className="text-primary h-5 w-5 animate-pulse" />
          Add New User
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Register a new team member and assign them a workspace role.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="Erlich Bachman"
              required
              className="bg-background/80 focus-visible:ring-primary h-10 border-input transition-colors focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="erlich@bachmanity.com"
              required
              className="bg-background/80 focus-visible:ring-primary h-10 border-input transition-colors focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="text-sm font-medium">Workspace Role</Label>
            <div className="relative">
              <select
                id="role"
                name="role"
                required
                defaultValue="member"
                className="bg-background/80 border-input text-foreground focus:border-primary focus:ring-primary flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="member">Member</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {state.error && (
            <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          {state.success && (
            <div className="text-emerald-500 bg-emerald-500/10 border-emerald-500/20 flex items-center gap-2 rounded-lg border p-3 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>User added successfully! Sending invitation...</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {onClose && (
              <button
                type="button"
                disabled={isPending || state.success}
                onClick={onClose}
                className="w-1/3 cursor-pointer rounded-md border border-input bg-background hover:bg-accent text-foreground font-semibold shadow-sm transition-all duration-300 flex items-center justify-center text-sm"
              >
                Cancel
              </button>
            )}
            <Button
              type="submit"
              disabled={isPending || state.success}
              className={`${onClose ? 'w-2/3' : 'w-full'}`}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding User...
                </>
              ) : (
                'Add User'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
