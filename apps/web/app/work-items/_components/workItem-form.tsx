'use client';

import { WORK_ITEM_TYPES, type WorkItemType } from '@repo/types';
import { useState, type FormEvent } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { DialogFooter } from '@repo/ui/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Loader2 } from '@repo/ui/lib/icons';
import { User as DbUser } from '@/app/users/_services/users.service';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import {
  createWorkItem,
  updateWorkItem,
} from '@/app/work-items/_services/workItem.service.client';
import { FormStatusAlerts } from '@/app/work-items/_components/workItem-form-alerts';
import { Project as DbProject } from '@/app/projects/_services/projects.service';
import { delay } from '@/app/_shared/utility';
import { ResponseDTO } from '@repo/types/connection';

type WorkItemFormMember = Pick<DbUser, 'id' | 'name' | 'email'>;

interface WorkItemFormProps {
  onClose?: () => void;
  // eslint-disable-next-line no-unused-vars
  onSuccess: (workItem: DbWorkItem) => void;
  projects: DbProject[];
  itemToEdit?: DbWorkItem | null;
  projectMembers: readonly WorkItemFormMember[];
  /** When true, project select is disabled (value still submitted). */
  lockProject?: boolean;
  /** When set, assignee select is disabled and defaults to this user on create. */
  lockAssigneeId?: string;
  /** Parent work item for subtask create (submitted as parent_id). */
  parentId?: string | null;
  /** Restrict selectable types (defaults to all work-item types). */
  allowedTypes?: readonly WorkItemType[];
  /** When true, type select is disabled (value still submitted). */
  lockType?: boolean;
}

const taskTypes = WORK_ITEM_TYPES;

const SubmitButtonText = ({
  isPending,
  isEditMode,
}: Readonly<{ isPending: boolean; isEditMode: boolean }>) => {
  if (isPending) {
    return (
      <>
        <Loader2 className="animate-spin" />
        {isEditMode ? 'Saving...' : 'Creating...'}
      </>
    );
  }

  if (isEditMode) {
    return 'Save Changes';
  }

  return 'Create Work Item';
};

export function WorkItemForm({
  onClose,
  onSuccess,
  itemToEdit = null,
  projectMembers,
  projects,
  lockProject = false,
  lockAssigneeId,
  parentId = null,
  allowedTypes,
  lockType = false,
}: Readonly<WorkItemFormProps>) {
  const availableTypes =
    allowedTypes && allowedTypes.length > 0 ? allowedTypes : taskTypes;
  const typeLocked = lockType || availableTypes.length === 1;

  const [isPending, setPending] = useState(false);
  const [state, setState] = useState<{
    success: string | null;
    error: string | null;
  } | null>(null);
  const [projectId, setProjectId] = useState(
    itemToEdit?.project_id ?? (lockProject ? (projects[0]?.id ?? '') : '')
  );
  const [assigneeId, setAssigneeId] = useState(
    itemToEdit?.assignee_id ?? lockAssigneeId ?? ''
  );
  const [type, setType] = useState(
    itemToEdit?.type ?? (typeLocked ? (availableTypes[0] ?? '') : '')
  );
  const isEditMode = itemToEdit !== null;
  const lockAssignee = Boolean(lockAssigneeId);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setState(null);

    const formData = new FormData(event.currentTarget);

    try {
      const isUpdate = isEditMode && itemToEdit;
      let response: ResponseDTO<DbWorkItem> | null = null;
      if (isUpdate) {
        response = await updateWorkItem(itemToEdit.id, formData);
      } else {
        response = await createWorkItem(formData);
      }

      setState({
        success: isEditMode
          ? 'Work item updated successfully.'
          : 'Work item created successfully.',
        error: null,
      });

      await delay();

      onSuccess(response.data!);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong.';
      setState({ success: null, error: message });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Title */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            placeholder="e.g. Implement dashboard filters"
            defaultValue={itemToEdit?.title ?? ''}
          />
        </div>

        {/* Project */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="project_id">Project</Label>
          <Select
            value={projectId}
            onValueChange={setProjectId}
            disabled={lockProject}
          >
            <SelectTrigger id="project_id">
              <SelectValue placeholder="Select project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="project_id" value={projectId} />
        </div>

        {/* Type */}
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select value={type} onValueChange={setType} disabled={typeLocked}>
            <SelectTrigger id="type">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {availableTypes.map((taskType) => (
                <SelectItem key={taskType} value={taskType}>
                  {taskType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="type" value={type} />
        </div>

        {parentId ? (
          <input type="hidden" name="parent_id" value={parentId} />
        ) : null}

        {/* Due date */}
        <div className="space-y-2">
          <Label htmlFor="due_date">Due date</Label>
          <Input
            id="due_date"
            name="due_date"
            type="date"
            defaultValue={itemToEdit?.due_date ?? ''}
          />
        </div>

        {/* Assign To */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="assignee_id">Assign to</Label>
          <Select
            value={assigneeId}
            onValueChange={setAssigneeId}
            disabled={lockAssignee}
          >
            <SelectTrigger id="assignee_id">
              <SelectValue placeholder="Select assignee..." />
            </SelectTrigger>
            <SelectContent>
              {projectMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name} ({member.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="assignee_id" value={assigneeId} />
        </div>

        {/* Story Points */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="story_points">Story points</Label>
          <Input
            id="story_points"
            name="story_points"
            type="number"
            min="0"
            step="1"
            placeholder="Enter Story Points"
            defaultValue={itemToEdit?.story_points ?? ''}
          />
        </div>
      </div>

      <FormStatusAlerts error={state?.error} success={state?.success} />

      <DialogFooter>
        {onClose ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit">
          <SubmitButtonText isPending={isPending} isEditMode={isEditMode} />
        </Button>
      </DialogFooter>
    </form>
  );
}
