'use client';

import { FormEvent, useEffect, useState, type ChangeEvent } from 'react';
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
import { cn } from '@repo/ui/lib/utils';
import type { Tables } from '@repo/types';
import {
  Loader2,
  X,
  CalendarPlus,
  CalendarCog,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { createSprint, getSprint, updateSprint, Sprint } from '../_services/sprints.service';
import { apiFetch } from '@/lib/api/api-client';

type SprintFormProps = {
  className?: string;
  sprintId?: string;
  // eslint-disable-next-line no-unused-vars
  onSprintUpdated?: (sprint: Sprint) => void;
  onClose?: () => void;
  onSuccess?: () => void;
};

function validateSprintForm(
  name: string,
  startDate: string,
  endDate: string,
  selectedProjectId: string
): string | null {
  if (!name.trim() || !startDate || !endDate) {
    return 'Name, start date, and end date are required.';
  }
  if (endDate < startDate) {
    return 'End date must be on or after the start date.';
  }
  if (!selectedProjectId) {
    return 'A project must be selected.';
  }
  return null;
}

function filterAndSortProjects(projects: Tables<'projects'>[]): Tables<'projects'>[] {
  return projects
    .filter((p: Tables<'projects'>) => p.status === 'active' && !p.deleted_at)
    .sort((a: Tables<'projects'>, b: Tables<'projects'>) => a.name.localeCompare(b.name));
}

function renderProjectOptions(
  isLoadingProjects: boolean,
  projects: Tables<'projects'>[]
) {
  if (isLoadingProjects) {
    return (
      <option value="" disabled>
        Loading projects...
      </option>
    );
  }
  if (projects.length === 0) {
    return (
      <option value="" disabled>
        No active projects found.
      </option>
    );
  }
  return projects.map((proj: Tables<'projects'>) => (
    <option key={proj.id} value={proj.id}>
      {proj.name} ({proj.key})
    </option>
  ));
}

interface FormAlertMessageProps {
  message: string | null;
  isError: boolean;
}

function FormAlertMessage({ message, isError }: Readonly<FormAlertMessageProps>) {
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

export function SprintForm({
  className,
  sprintId,
  onSprintUpdated,
  onClose,
  onSuccess,
}: Readonly<SprintFormProps>) {
  const isEditMode = !!sprintId;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSprint, setIsLoadingSprint] = useState(isEditMode);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [projects, setProjects] = useState<Tables<'projects'>[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch active projects
  useEffect(() => {
    setIsLoadingProjects(true);
    apiFetch<{ projects: Tables<'projects'>[] }>('/api/projects')
      .then((data: { projects: Tables<'projects'>[] }) => {
        if (data.projects) {
          const activeProjects = filterAndSortProjects(data.projects);
          setProjects(activeProjects);
          // If in create mode and we have active projects, pre-select the first one
          if (!sprintId && activeProjects.length > 0 && activeProjects[0]) {
            setSelectedProjectId(activeProjects[0].id);
          }
        }
      })
      .catch((error: unknown) => {
        console.error('Error fetching active projects:', error);
      })
      .finally(() => {
        setIsLoadingProjects(false);
      });
  }, [sprintId]);

  // Fetch sprint details if in edit mode
  useEffect(() => {
    if (!sprintId) return;
    setIsLoadingSprint(true);
    getSprint(sprintId)
      .then((sprint: Sprint) => {
        setName(sprint.name);
        setGoal(sprint.goal ?? '');
        setStartDate(sprint.startDate);
        setEndDate(sprint.endDate);
        setSelectedProjectId(sprint.project?.id ?? '');
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load sprint.';
        setMessage(errorMessage);
        setIsError(true);
      })
      .finally(() => {
        setIsLoadingSprint(false);
      });
  }, [sprintId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const validationError = validateSprintForm(name, startDate, endDate, selectedProjectId);
    if (validationError) {
      setMessage(validationError);
      setIsError(true);
      setIsSubmitting(false);
      return;
    }

    try {
      const sprintData = {
        name: name.trim(),
        goal: goal.trim() || null,
        projectId: selectedProjectId,
        startDate,
        endDate,
      };

      let result: Sprint;
      if (sprintId) {
        result = await updateSprint(sprintId, sprintData);
        setMessage(`Sprint "${result.name}" updated.`);
      } else {
        result = await createSprint(sprintData);
        setMessage(`Sprint "${result.name}" created.`);
      }

      setIsSuccess(true);
      onSprintUpdated?.(result);
    } catch (error) {
      const modeText = sprintId ? 'update' : 'create';
      const errorMessage =
        error instanceof Error ? error.message : `Failed to ${modeText} sprint.`;
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

  let submitButtonContent;
  if (isSubmitting) {
    submitButtonContent = (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {sprintId ? 'Saving...' : 'Creating...'}
      </>
    );
  } else {
    submitButtonContent = sprintId ? 'Save Changes' : 'Create Sprint';
  }

  return (
    <Card
      className={cn(
        'relative border border-gray-200 bg-white text-gray-900 shadow-xl transition-all duration-300 hover:shadow-2xl',
        className
      )}
    >
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
          {sprintId ? (
            <CalendarCog className="text-primary h-5 w-5" />
          ) : (
            <CalendarPlus className="text-primary h-5 w-5 animate-pulse" />
          )}
          {sprintId ? 'Edit Sprint' : 'Create Sprint'}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          {sprintId
            ? 'Update the name, goal, project and date range of this sprint.'
            : 'Plan a new sprint with a name, goal, project and date range.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingSprint ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <p className="text-muted-foreground text-sm">Loading sprint details...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sprint-project">Project</Label>
              <select
                id="sprint-project"
                value={selectedProjectId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedProjectId(e.target.value)}
                required
                disabled={isLoadingProjects}
                className="bg-background/80 border-input text-foreground focus:border-primary focus:ring-primary ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
              >
                {renderProjectOptions(isLoadingProjects, projects)}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sprint-name">Sprint name</Label>
              <Input
                id="sprint-name"
                name="name"
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="Sprint 1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sprint-goal">Goal</Label>
              <textarea
                id="sprint-goal"
                name="goal"
                value={goal}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setGoal(e.target.value)}
                rows={3}
                placeholder="What should this sprint achieve?"
                className={cn(
                  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 w-full min-w-0 resize-y rounded-lg border bg-transparent px-2.5 py-2 text-base transition-colors outline-none focus-visible:ring-3 md:text-sm'
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sprint-start-date">Start date</Label>
                <Input
                  id="sprint-start-date"
                  name="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sprint-end-date">End date</Label>
                <Input
                  id="sprint-end-date"
                  name="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                  required
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
                {submitButtonContent}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
