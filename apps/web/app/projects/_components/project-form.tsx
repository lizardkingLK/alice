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
import { createProject, updateProject } from './actions';
import type { ActionState } from '@/lib/server-actions';
import {
  FolderPlus,
  FolderEdit,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react';
import type { Tables } from '@repo/types';

type DbUser = Tables<'users'>;
type DbProject = Tables<'projects'>;

const initialState: ActionState = {
  success: false,
  error: null,
};

interface ProjectFormProps {
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
  readonly projectToEdit?: DbProject | null;
  readonly users: DbUser[];
}

function formatDateForInput(dateString?: string | null) {
  if (!dateString) return '';
  return dateString.split('T')[0] ?? '';
}

export function ProjectForm({
  onClose,
  onSuccess,
  projectToEdit = null,
  users,
}: Readonly<ProjectFormProps>) {
  const isEditMode = !!projectToEdit;

  const boundAction = isEditMode
    ? updateProject.bind(null, projectToEdit.id)
    : createProject;

  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState
  );

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      if (!isEditMode) {
        formRef.current?.reset();
      }
      const timer = setTimeout(() => {
        onSuccess?.();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [state.success, onSuccess, isEditMode]);

  let submitButtonText: ReactNode;
  if (isPending) {
    submitButtonText = (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {isEditMode ? 'Updating...' : 'Creating...'}
      </>
    );
  } else if (isEditMode) {
    submitButtonText = 'Save Changes';
  } else {
    submitButtonText = 'Create Project';
  }

  return (
    <Card className="border-border bg-card text-card-foreground relative border shadow-2xl transition-all duration-300">
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
          {isEditMode ? (
            <FolderEdit className="text-primary h-5 w-5" />
          ) : (
            <FolderPlus className="text-primary h-5 w-5 animate-pulse" />
          )}
          {isEditMode ? 'Edit Project' : 'Create New Project'}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          {isEditMode
            ? 'Modify details for the existing project.'
            : 'Register a new project workspace to organize tasks and sprints.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Project Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Alice Platform"
                required
                defaultValue={projectToEdit?.name ?? ''}
                className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="key" className="text-sm font-medium">
                Project Key
              </Label>
              <Input
                id="key"
                name="key"
                placeholder="e.g. ALICE"
                required
                maxLength={10}
                defaultValue={projectToEdit?.key ?? ''}
                className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 uppercase transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Input
              id="description"
              name="description"
              placeholder="e.g. Core platform squad for JIRA clone"
              defaultValue={projectToEdit?.description ?? ''}
              className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="owner_id" className="text-sm font-medium">
                Project Owner
              </Label>
              <select
                id="owner_id"
                name="owner_id"
                required
                defaultValue={projectToEdit?.owner_id ?? ''}
                className="bg-background/80 border-input text-foreground focus:border-primary focus:ring-primary ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <option value="" disabled>
                  Select Owner...
                </option>
                {users
                  .filter((u) => u.role === 'manager')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm font-medium">
                Status
              </Label>
              <select
                id="status"
                name="status"
                required
                defaultValue={projectToEdit?.status ?? 'active'}
                className="bg-background/80 border-input text-foreground focus:border-primary focus:ring-primary ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date" className="text-sm font-medium">
                Start Date
              </Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={formatDateForInput(projectToEdit?.start_date)}
                className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date" className="text-sm font-medium">
                End Date
              </Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={formatDateForInput(projectToEdit?.end_date)}
                className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
              />
            </div>
          </div>

          {state.error && (
            <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          {state.success && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-500">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>
                {isEditMode
                  ? 'Project updated successfully!'
                  : 'Project created successfully!'}
              </span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {onClose && (
              <button
                type="button"
                disabled={isPending || state.success}
                onClick={onClose}
                className="border-input bg-background hover:bg-accent text-foreground flex w-1/3 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold shadow-sm transition-all duration-300"
              >
                Cancel
              </button>
            )}
            <Button
              type="submit"
              disabled={isPending || state.success}
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
