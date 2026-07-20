'use client';

import { FormAlertMessage } from '@/app/_shared/form-alert-message';
import {
  FormEvent,
  useEffect,
  useState,
  useMemo,
  type ChangeEvent,
} from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { cn } from '@repo/ui/lib/utils';
import type { Tables } from '@repo/types';
import {
  Loader2,
  X,
  CalendarPlus,
  CalendarCog,
} from '@repo/ui/lib/icons';
import {
  createSprint,
  getSprint,
  updateSprint,
  Sprint,
} from '../_services/sprints.service';
import { apiFetch } from '@/lib/api/api-client';

type SprintFormProps = {
  className?: string;
  sprintId?: string;
  // eslint-disable-next-line no-unused-vars
  onSprintUpdated?: (sprint: Sprint) => void;
  onClose?: () => void;
  onSuccess?: () => void;
  currentUserId?: string | null;
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

function filterAndSortProjects(
  projects: Tables<'projects'>[]
): Tables<'projects'>[] {
  return projects
    .filter((p: Tables<'projects'>) => p.status === 'active' && !p.deleted_at)
    .sort((a: Tables<'projects'>, b: Tables<'projects'>) =>
      a.name.localeCompare(b.name)
    );
}

function renderProjectOptions(
  isLoadingProjects: boolean,
  projects: Tables<'projects'>[]
) {
  if (isLoadingProjects) {
    return (
      <SelectItem value="loading" disabled>
        Loading projects...
      </SelectItem>
    );
  }
  if (projects.length === 0) {
    return (
      <SelectItem value="none" disabled>
        No active projects found.
      </SelectItem>
    );
  }
  return projects.map((proj: Tables<'projects'>) => (
    <SelectItem key={proj.id} value={proj.id}>
      {proj.name} ({proj.key})
    </SelectItem>
  ));
}


export function SprintForm({
  className,
  sprintId,
  onSprintUpdated,
  onClose,
  onSuccess,
  currentUserId,
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

  // Filter projects to only show user's own projects
  // Plus the project of the sprint if in edit mode (even if they don't own it)
  const displayedProjects = useMemo(() => {
    if (!currentUserId) return projects;
    return projects.filter(
      (p) => p.owner_id === currentUserId || p.id === selectedProjectId
    );
  }, [projects, currentUserId, selectedProjectId]);

  // Fetch active projects
  useEffect(() => {
    setIsLoadingProjects(true);
    apiFetch<{ projects: Tables<'projects'>[] }>('/api/projects')
      .then((data: { projects: Tables<'projects'>[] }) => {
        if (data.projects) {
          const activeProjects = filterAndSortProjects(data.projects);
          setProjects(activeProjects);
          // If in create mode and we have active projects, pre-select the first one
          if (!sprintId) {
            const ownProjects = currentUserId
              ? activeProjects.filter((p) => p.owner_id === currentUserId)
              : activeProjects;
            if (ownProjects.length > 0 && ownProjects[0]) {
              setSelectedProjectId(ownProjects[0].id);
            }
          }
        }
      })
      .catch((error: unknown) => {
        console.error('Error fetching active projects:', error);
      })
      .finally(() => {
        setIsLoadingProjects(false);
      });
  }, [sprintId, currentUserId]);

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
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to load sprint.';
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

    const validationError = validateSprintForm(
      name,
      startDate,
      endDate,
      selectedProjectId
    );
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
        error instanceof Error
          ? error.message
          : `Failed to ${modeText} sprint.`;
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
            <p className="text-muted-foreground text-sm">
              Loading sprint details...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sprint-project">Project</Label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
                disabled={isLoadingProjects}
              >
                <SelectTrigger
                  id="sprint-project"
                  className="bg-background/80 h-10 w-full"
                >
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  {renderProjectOptions(isLoadingProjects, displayedProjects)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sprint-name">Sprint name</Label>
              <Input
                id="sprint-name"
                name="name"
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setName(e.target.value)
                }
                placeholder="Sprint 1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sprint-goal">Goal</Label>
              <Textarea
                id="sprint-goal"
                name="goal"
                value={goal}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setGoal(e.target.value)
                }
                rows={3}
                placeholder="What should this sprint achieve?"
                className="bg-transparent"
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
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setStartDate(e.target.value)
                  }
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
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setEndDate(e.target.value)
                  }
                  required
                />
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
                {submitButtonContent}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
