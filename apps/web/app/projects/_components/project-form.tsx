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
import {
  FolderPlus,
  FolderEdit,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react';
import type { User } from '@/app/users/_services/users.service';
import {
  createProject,
  updateProject,
  getProject,
  type Project,
} from '../_services/projects.service';

interface ProjectFormProps {
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
  readonly projectId?: string;
  readonly users: User[];
  // eslint-disable-next-line no-unused-vars
  readonly onProjectUpdated?: (project: Project) => void;
}

function formatDateForInput(dateString?: string | null) {
  if (!dateString) return '';
  return dateString.split('T')[0] ?? '';
}

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

export function ProjectForm({
  onClose,
  onSuccess,
  projectId,
  users,
  onProjectUpdated,
}: Readonly<ProjectFormProps>) {
  const isEditMode = !!projectId;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(isEditMode);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Set default start date to today's date for create mode
  useEffect(() => {
    if (!isEditMode) {
      setStartDate(getTodayDateString());
    }
  }, [isEditMode]);

  // Fetch project details if in edit mode
  useEffect(() => {
    if (!projectId) return;
    setIsLoadingProject(true);
    getProject(projectId)
      .then((project: Project) => {
        setName(project.name);
        setKey(project.key);
        setDescription(project.description ?? '');
        setSelectedOwnerId(project.owner_id);
        setStatus(project.status);
        setStartDate(formatDateForInput(project.start_date));
        setEndDate(formatDateForInput(project.end_date));
      })
      .catch((error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to load project.';
        setMessage(errorMessage);
        setIsError(true);
      })
      .finally(() => {
        setIsLoadingProject(false);
      });
  }, [projectId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    if (!name.trim() || !key.trim() || !selectedOwnerId) {
      setMessage('Project Name, Key, and Owner are required.');
      setIsError(true);
      setIsSubmitting(false);
      return;
    }

    try {
      const projectData = {
        name: name.trim(),
        key: key.toUpperCase().trim(),
        description: description.trim() || null,
        owner_id: selectedOwnerId,
        start_date: startDate || null,
        end_date: endDate || null,
        status: status,
      };

      let result;
      if (projectId) {
        result = await updateProject(projectId, projectData);
        setMessage(`Project "${result.name}" updated.`);
      } else {
        result = await createProject(projectData);
        setMessage(`Project "${result.name}" created.`);
      }

      setIsSuccess(true);
      onProjectUpdated?.(result as Project);
    } catch (error) {
      const modeText = projectId ? 'update' : 'create';
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Failed to ${modeText} project.`;
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

  let submitButtonText;
  if (isSubmitting) {
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
        {isLoadingProject ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <p className="text-muted-foreground text-sm">
              Loading project details...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Project Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setName(e.target.value)
                  }
                  placeholder="e.g. Alice Platform"
                  required
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
                  value={key}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setKey(e.target.value)
                  }
                  placeholder="e.g. ALICE"
                  required
                  maxLength={10}
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
                value={description}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setDescription(e.target.value)
                }
                placeholder="e.g. Core platform squad for JIRA clone"
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
                  value={selectedOwnerId}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setSelectedOwnerId(e.target.value)
                  }
                  required
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
                  value={status}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setStatus(e.target.value as 'active' | 'archived')
                  }
                  required
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
                  value={startDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setStartDate(e.target.value)
                  }
                  min={isEditMode ? undefined : getTodayDateString()}
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
                  value={endDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setEndDate(e.target.value)
                  }
                  className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
                />
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
        )}
      </CardContent>
    </Card>
  );
}
