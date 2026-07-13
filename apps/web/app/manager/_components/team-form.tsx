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
import { cn } from '@repo/ui/lib/utils';
import { Users, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';
import type { Tables } from '@repo/types';
import type { User } from '@/app/users/_services/users.service';
import { createTeam, updateTeam } from '../_services/teams.service';

type DbTeam = Tables<'teams'>;

interface TeamFormProps {
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
  readonly teamToEdit?: DbTeam | null;
  readonly users: User[];
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

export function TeamForm({
  onClose,
  onSuccess,
  teamToEdit = null,
  users,
}: Readonly<TeamFormProps>) {
  const editActionActive = !!teamToEdit;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [name, setName] = useState(teamToEdit?.name ?? '');
  const [techStack, setTechStack] = useState(teamToEdit?.tech_stack ?? '');
  const [description, setDescription] = useState(teamToEdit?.description ?? '');
  const [managerId, setManagerId] = useState(teamToEdit?.manager_id ?? '');
  const [status, setStatus] = useState<'active' | 'inactive' | 'archived'>(
    teamToEdit?.status && teamToEdit.status !== 'deleted'
      ? teamToEdit.status
      : 'active'
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    if (!name.trim() || !managerId || !status) {
      setMessage('Team name, manager, and status are required.');
      setIsError(true);
      setIsSubmitting(false);
      return;
    }

    try {
      const teamData = {
        name: name.trim(),
        tech_stack: techStack.trim() || null,
        description: description.trim() || null,
        manager_id: managerId,
        status: status,
      };

      if (editActionActive && teamToEdit) {
        await updateTeam(teamToEdit.id, teamData);
        setMessage('The team configuration has been successfully updated.');
      } else {
        await createTeam(teamData);
        setMessage('A new team record has been successfully registered.');
      }

      setIsSuccess(true);
    } catch (error) {
      const modeText = editActionActive ? 'update' : 'create';
      const errorMessage =
        error instanceof Error ? error.message : `Failed to ${modeText} team.`;
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
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onSuccess]);

  let buttonLabelContent;
  if (isSubmitting) {
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Team Identifier / Name
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Platform Team"
              required
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
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
              value={techStack}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setTechStack(e.target.value)
              }
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
              value={description}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setDescription(e.target.value)
              }
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
              value={managerId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setManagerId(e.target.value)
              }
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
              value={status}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setStatus(e.target.value as 'active' | 'inactive' | 'archived')
              }
              className="bg-background/80 border-input text-foreground focus:border-primary focus:ring-primary ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <FormAlertMessage message={message} isError={isError} />

          <div className="flex gap-3 pt-2">
            {onClose && (
              <button
                type="button"
                disabled={isSubmitting || isSuccess}
                onClick={onClose}
                className="border-input bg-background hover:bg-accent text-foreground flex w-1/3 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold shadow-sm transition-all duration-300 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || isSuccess}
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
