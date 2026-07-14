'use client';

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
import { AlertCircle, CheckCircle, Loader2 } from '@repo/ui/lib/icons';
import { User as DbUser } from '@/app/users/_services/users.service';
import { DbWorkItem } from '@/app/work-items/_services/workItem.server.service';
import {
  createWorkItem,
  updateWorkItem,
} from '@/app/work-items/_services/workItem.client.service';
import { Project as DbProject } from '@/app/projects/_services/projects.service';
import { delay } from '@/app/_shared/utility';
import { ResponseDTO } from '@repo/types/connection';

interface WorkItemFormProps {
  onClose?: () => void;
  // eslint-disable-next-line no-unused-vars
  onSuccess: (workItem: DbWorkItem) => void;
  projects: DbProject[];
  itemToEdit?: DbWorkItem | null;
  projectMembers: DbUser[];
}

const taskTypes = ['Epic', 'Story', 'Task'] as const;

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
}: Readonly<WorkItemFormProps>) {
  const [isPending, setPending] = useState(false);
  const [state, setState] = useState<{
    success: string | null;
    error: string | null;
  } | null>(null);
  const [projectId, setProjectId] = useState(itemToEdit?.project_id ?? '');
  const [assigneeId, setAssigneeId] = useState(itemToEdit?.assignee_id ?? '');
  const [type, setType] = useState(itemToEdit?.type ?? '');
  const isEditMode = itemToEdit !== null;

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
          <Select value={projectId} onValueChange={setProjectId}>
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
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="type">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {taskTypes.map((taskType) => (
                <SelectItem key={taskType} value={taskType}>
                  {taskType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="type" value={type} />
        </div>

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
          <Select value={assigneeId} onValueChange={setAssigneeId}>
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
      </div>

      {state?.error ? (
        <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3 text-sm">
          <AlertCircle className="size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      {state?.success ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="size-4 shrink-0" />
          <span>{state.success}</span>
        </div>
      ) : null}

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
