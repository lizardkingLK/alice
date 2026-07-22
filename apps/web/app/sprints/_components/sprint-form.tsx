'use client';

import { FormAlertMessage } from '@/components/form-alert-message';
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
import { Loader2, X, CalendarPlus, CalendarCog } from '@repo/ui/lib/icons';
import {
  createSprint,
  updateSprint,
  Sprint,
} from '../_services/sprints.service';
import type { Project } from '@/app/projects/_services/projects.service.base';
import { filterActiveProjects } from '@/lib/projects/active-projects';

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

function renderProjectOptions(projects: Project[]) {
  if (projects.length === 0) {
    return (
      <SelectItem value="none" disabled>
        No active projects found.
      </SelectItem>
    );
  }
  return projects.map((proj) => (
    <SelectItem key={proj.id} value={proj.id}>
      {proj.name} ({proj.key})
    </SelectItem>
  ));
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const activeProjects = useMemo(
    () => filterActiveProjects(projects),
    [projects]
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    sprintToEdit?.project?.id ?? ''
  );
  const [name, setName] = useState(sprintToEdit?.name ?? '');
  const [goal, setGoal] = useState(sprintToEdit?.goal ?? '');
  const [startDate, setStartDate] = useState(sprintToEdit?.startDate ?? '');
  const [endDate, setEndDate] = useState(sprintToEdit?.endDate ?? '');

  const displayedProjects = useMemo(() => {
    if (!currentUserId) return activeProjects;
    return activeProjects.filter(
      (project) =>
        project.owner_id === currentUserId || project.id === selectedProjectId
    );
  }, [activeProjects, currentUserId, selectedProjectId]);

  useEffect(() => {
    if (sprintToEdit) {
      setName(sprintToEdit.name);
      setGoal(sprintToEdit.goal ?? '');
      setStartDate(sprintToEdit.startDate);
      setEndDate(sprintToEdit.endDate);
      setSelectedProjectId(sprintToEdit.project?.id ?? '');
      return;
    }

    const ownProjects = currentUserId
      ? activeProjects.filter((project) => project.owner_id === currentUserId)
      : activeProjects;
    if (ownProjects.length > 0 && ownProjects[0]) {
      setSelectedProjectId(ownProjects[0].id);
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
        result = await updateSprint(sprintToEdit.id, sprintData);
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
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger
                id="sprint-project"
                className="bg-background/80 h-10 w-full"
              >
                <SelectValue placeholder="Select project..." />
              </SelectTrigger>
              <SelectContent>
                {renderProjectOptions(displayedProjects)}
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
      </CardContent>
    </Card>
  );
}
