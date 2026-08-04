'use client';

import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { SearchableSelect } from '@/components/searchable-select';
import type { WorkItemFormSharedFieldProps } from '@/app/work-items/_components/work-item-form-field-props';
import { WorkItemPrioritySelect } from '@/app/work-items/_components/work-item-priority-select';

export type WorkItemFormClassicFieldsProps = WorkItemFormSharedFieldProps & {
  readonly titleDefault?: string;
  readonly dueDateDefault?: string;
  readonly storyPointsDefault?: number | null;
};

/**
 * Classic labeled create/edit fields.
 * Shares the same FormData field names as the modern create form.
 */
export function WorkItemFormClassicFields({
  projects,
  projectMembers,
  availableTypes,
  projectId,
  assigneeId,
  type,
  priority,
  parentId = null,
  lockProject,
  lockAssignee,
  typeLocked,
  titleDefault = '',
  dueDateDefault = '',
  storyPointsDefault = null,
  onProjectIdChange,
  onAssigneeIdChange,
  onTypeChange,
  onPriorityChange,
}: Readonly<WorkItemFormClassicFieldsProps>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          placeholder="e.g. Implement dashboard filters"
          defaultValue={titleDefault}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="project_id">Project</Label>
        <SearchableSelect
          id="project_id"
          value={projectId}
          onValueChange={onProjectIdChange}
          disabled={lockProject}
          placeholder="Search projects…"
          options={projects.map((project) => ({
            value: project.id,
            label: project.name,
          }))}
          emptyText="No matching projects."
        />
        <input type="hidden" name="project_id" value={projectId} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select value={type} onValueChange={onTypeChange} disabled={typeLocked}>
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

      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <WorkItemPrioritySelect
          priority={priority}
          onPriorityChange={onPriorityChange}
        />
      </div>

      {parentId ? (
        <input type="hidden" name="parent_id" value={parentId} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="due_date">Due date</Label>
        <Input
          id="due_date"
          name="due_date"
          type="date"
          defaultValue={dueDateDefault}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="assignee_id">Assign to</Label>
        <SearchableSelect
          id="assignee_id"
          value={assigneeId}
          onValueChange={onAssigneeIdChange}
          disabled={lockAssignee}
          placeholder="Search assignees…"
          options={projectMembers.map((member) => ({
            value: member.id,
            label: `${member.name} (${member.email})`,
          }))}
          emptyText="No matching assignees."
        />
        <input type="hidden" name="assignee_id" value={assigneeId} />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="story_points">Story points</Label>
        <Input
          id="story_points"
          name="story_points"
          type="number"
          min="0"
          step="1"
          placeholder="Enter Story Points"
          defaultValue={storyPointsDefault ?? ''}
        />
      </div>
    </div>
  );
}
