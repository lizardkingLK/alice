'use client';

import { FormCancelSubmitActions } from '@/components/form-cancel-submit-actions';
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
import { Textarea } from '@repo/ui/components/ui/textarea';
import { SearchableSelect } from '@/components/searchable-select';
import { cn } from '@repo/ui/lib/utils';
import { Loader2, X, CalendarPlus, CalendarCog } from '@repo/ui/lib/icons';
import {
  createSprint,
  updateSprint,
  Sprint,
} from '../_services/sprints.service';
import type { Project } from '@/app/projects/_services/projects.service.base';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { loadProjectsForSprintForm } from '@/lib/cache/load-projects-for-forms';
import { createClient } from '@/lib/supabase/client';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';

type SprintFormProps = {
  className?: string;
  projects: Project[];
  sprintToEdit?: Sprint | null;
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

function projectSelectOptions(projects: Project[]) {
  return projects.map((proj) => ({
    value: proj.id,
    label: `${proj.name} (${proj.key})`,
  }));
}

export function SprintForm({
  className,
  projects,
  sprintToEdit = null,
  onSprintUpdated,
  onClose,
  onSuccess,
  currentUserId,
}: Readonly<SprintFormProps>) {
  const isEditMode = !!sprintToEdit;
  const { handleMutationError } = useOptimisticLock();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [projectList, setProjectList] = useState(projects);

  useEffect(() => {
    setProjectList(projects);
  }, [projects]);

  useEffect(() => {
    if (isEditMode) {
      return;
    }

    let cancelled = false;
    loadProjectsForSprintForm()
      .then((fresh) => {
        if (!cancelled) {
          setProjectList(fresh);
        }
      })
      .catch((error: unknown) => {
        console.error(
          'error. failed to refresh projects for sprint form:',
          error
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isEditMode]);

  const activeProjects = useMemo(
    () => filterActiveProjects(projectList),
    [projectList]
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    sprintToEdit?.project?.id ?? ''
  );
  const [name, setName] = useState(sprintToEdit?.name ?? '');
  const [goal, setGoal] = useState(sprintToEdit?.goal ?? '');
  const [startDate, setStartDate] = useState(sprintToEdit?.startDate ?? '');
  const [endDate, setEndDate] = useState(sprintToEdit?.endDate ?? '');
  const [hasWorkItems, setHasWorkItems] = useState(false);

  useEffect(() => {
    if (sprintToEdit) {
      try {
        const supabase = createClient();
        supabase
          .from('work_items')
          .select('*', { count: 'exact', head: true })
          .eq('sprint_id', sprintToEdit.id)
          .eq('record_status', 'active')
          .then(({ count, error }) => {
            if (!error && count && count > 0) {
              setHasWorkItems(true);
            }
          });
      } catch (error) {
        console.error('Failed to check sprint work items:', error);
      }
    } else {
      setHasWorkItems(false);
    }
  }, [sprintToEdit]);

  const displayedProjects = activeProjects;

  useEffect(() => {
    if (sprintToEdit) {
      setName(sprintToEdit.name);
      setGoal(sprintToEdit.goal ?? '');
      setStartDate(sprintToEdit.startDate);
      setEndDate(sprintToEdit.endDate);
      setSelectedProjectId(sprintToEdit.project?.id ?? '');
      return;
    }

    // Prefer an owned project as the default, but the list includes every
    // active project — admins/managers may create sprints on any of them.
    const preferred =
      (currentUserId
        ? activeProjects.find((project) => project.owner_id === currentUserId)
        : undefined) ?? activeProjects[0];
    if (preferred) {
      setSelectedProjectId(preferred.id);
    }
  }, [sprintToEdit, activeProjects, currentUserId]);

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
      if (sprintToEdit) {
        const expectedUpdatedAt = sprintToEdit.updatedAt;
        const updated = await runLockedMutationOrThrow({
          mutate: () =>
            updateSprint(sprintToEdit.id, sprintData, expectedUpdatedAt),
          handleMutationError,
          entityType: 'sprint',
          entityId: sprintToEdit.id,
          expectedUpdatedAt,
          pendingFields: sprintData,
          currentUserId,
        });
        if (!updated) {
          return;
        }
        result = updated;
        setMessage(`Sprint "${result.name}" updated.`);
      } else {
        result = await createSprint(sprintData);
        setMessage(`Sprint "${result.name}" created.`);
      }

      setIsSuccess(true);
      onSprintUpdated?.(result);
    } catch (error) {
      const modeText = sprintToEdit ? 'update' : 'create';
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
        {isEditMode ? 'Saving...' : 'Creating...'}
      </>
    );
  } else {
    submitButtonContent = isEditMode ? 'Save Changes' : 'Create Sprint';
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
          {isEditMode ? (
            <CalendarCog className="text-primary h-5 w-5" />
          ) : (
            <CalendarPlus className="text-primary h-5 w-5 animate-pulse" />
          )}
          {isEditMode ? 'Edit Sprint' : 'Create Sprint'}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          {isEditMode
            ? 'Update the name, goal, project and date range of this sprint.'
            : 'Plan a new sprint with a name, goal, project and date range.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sprint-project">Project</Label>
            <SearchableSelect
              id="sprint-project"
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              disabled={isEditMode && hasWorkItems}
              placeholder="Search projects…"
              options={projectSelectOptions(displayedProjects)}
              emptyText="No matching projects."
            />
            {isEditMode && hasWorkItems && (
              <p className="text-muted-foreground text-xs">
                Project cannot be changed because this sprint has work items
                assigned to it.
              </p>
            )}
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

          <FormCancelSubmitActions
            message={message}
            isError={isError}
            isBusy={isSubmitting || isSuccess}
            onCancel={onClose}
            submitLabel={submitButtonContent}
          />
        </form>
      </CardContent>
    </Card>
  );
}
