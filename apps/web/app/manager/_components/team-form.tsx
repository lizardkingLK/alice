'use client';

import { useActionState, useEffect, useRef, ReactNode } from 'react';
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
import { createTeam, updateTeam } from './actions';
import type { ActionState } from '@/lib/server-actions';
import {
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react';
import type { Tables } from '@repo/types';

type DbUser = Tables<'users'>;
type DbTeam = Tables<'teams'>;

const initialActionState: ActionState = {
  success: false,
  error: null,
};

interface TeamFormProps {
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
  readonly teamToEdit?: DbTeam | null;
  readonly users: DbUser[];
}

export function TeamForm({
  onClose,
  onSuccess,
  teamToEdit = null,
  users,
}: Readonly<TeamFormProps>) {
  const editActionActive = !!teamToEdit;

  const serverActionTarget = editActionActive
    ? updateTeam.bind(null, teamToEdit.id)
    : createTeam;

  const [formState, executeAction, isActionPending] = useActionState(
    serverActionTarget,
    initialActionState
  );

  const teamFormReference = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (formState.success) {
      if (!editActionActive) {
        teamFormReference.current?.reset();
      }
      const completionTimer = setTimeout(() => {
        onSuccess?.();
      }, 1200);
      return () => clearTimeout(completionTimer);
    }
  }, [formState.success, onSuccess, editActionActive]);

  let buttonLabelContent: ReactNode;
  if (isActionPending) {
    buttonLabelContent = (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {editActionActive ? 'Updating team details...' : 'Creating new team...'}
      </>
    );
  } else {
    buttonLabelContent = editActionActive ? 'Save Changes' : 'Create Team';
  }

  return (
    <Card className="border-border bg-card text-card-foreground relative border shadow-2xl transition-all duration-300">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="hover:bg-muted text-muted-foreground hover:text-foreground absolute top-4 right-4 cursor-pointer rounded-full p-1.5 transition-colors"
          aria-label="Dismiss form"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="text-primary h-5 w-5" />
          {editActionActive ? 'Modify Team Configuration' : 'Register New Team'}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          {editActionActive
            ? 'Update the settings, tech stack, and manager of the selected team.'
            : 'Register a new engineering team workspace to organize resources.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={teamFormReference} action={executeAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Team Identifier / Name
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Platform Team"
              required
              defaultValue={teamToEdit?.name ?? ''}
              className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tech_stack" className="text-sm font-medium">
              Primary Technology Stack
            </Label>
            <Input
              id="tech_stack"
              name="tech_stack"
              placeholder="e.g. Next.js, Node, Postgres"
              defaultValue={teamToEdit?.tech_stack ?? ''}
              className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Role Description
            </Label>
            <Input
              id="description"
              name="description"
              placeholder="e.g. Core team responsible for monorepo and API infrastructure"
              defaultValue={teamToEdit?.description ?? ''}
              className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager_id" className="text-sm font-medium">
              Designated Team Manager
            </Label>
            <select
              id="manager_id"
              name="manager_id"
              required
              defaultValue={teamToEdit?.manager_id ?? ''}
              className="bg-background/80 border-input text-foreground focus:border-primary focus:ring-primary ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <option value="" disabled>
                Select Manager...
              </option>
              {users
                .filter((u) => u.role === 'manager' || u.role === 'admin')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-medium">
              Team Status
            </Label>
            <select
              id="status"
              name="status"
              required
              defaultValue={teamToEdit?.status ?? 'active'}
              className="bg-background/80 border-input text-foreground focus:border-primary focus:ring-primary ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {formState.error && (
            <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Failed: {formState.error}</span>
            </div>
          )}

          {formState.success && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-500">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>
                {editActionActive
                  ? 'The team configuration has been successfully updated.'
                  : 'A new team record has been successfully registered.'}
              </span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {onClose && (
              <button
                type="button"
                disabled={isActionPending || formState.success}
                onClick={onClose}
                className="border-input bg-background hover:bg-accent text-foreground disabled:opacity-50 flex w-1/3 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold shadow-sm transition-all duration-300"
              >
                Cancel
              </button>
            )}
            <Button
              type="submit"
              disabled={isActionPending || formState.success}
              className={`${onClose ? 'w-2/3' : 'w-full'}`}
            >
              {buttonLabelContent}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
