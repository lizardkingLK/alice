'use client';

import { useState } from 'react';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { SearchableSelect } from '@/components/searchable-select';
import type { WorkItemFormSharedFieldProps } from '@/app/work-items/_components/work-item-form-field-props';
import {
  resolveShowParentPicker,
  WorkItemFormParentStatusSection,
} from '@/app/work-items/_components/work-item-form-parent-status';
import { WorkItemFormTypeSelect } from '@/app/work-items/_components/work-item-form-type-select';
import { WorkItemLabelsInput } from '@/app/work-items/_components/work-item-labels-input';
import { WorkItemPrioritySelect } from '@/app/work-items/_components/work-item-priority-select';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';

export type WorkItemFormClassicFieldsProps = WorkItemFormSharedFieldProps & {
  readonly titleDefault?: string;
  readonly dueDateDefault?: string;
  readonly storyPointsDefault?: number | null;
  readonly labelsDefault?: readonly string[];
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
  parentId,
  parentOptions,
  parentOptionsLoading,
  parentTypeLabel,
  lockParent,
  lockProject,
  lockAssignee,
  typeLocked,
  lockStatus,
  status,
  titleDefault = '',
  dueDateDefault = '',
  storyPointsDefault = null,
  labelsDefault = [],
  onProjectIdChange,
  onAssigneeIdChange,
  onTypeChange,
  onPriorityChange,
  onParentIdChange,
}: Readonly<WorkItemFormClassicFieldsProps>) {
  const [labels, setLabels] = useState<string[]>(() => [...labelsDefault]);
  const showParentPicker = resolveShowParentPicker(lockParent, parentTypeLabel);

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
        <WorkItemFormTypeSelect
          type={type}
          onTypeChange={onTypeChange}
          availableTypes={availableTypes}
          typeLocked={typeLocked}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <WorkItemPrioritySelect
          priority={priority}
          onPriorityChange={onPriorityChange}
        />
      </div>

      <WorkItemFormParentStatusSection
        lockStatus={lockStatus}
        status={status}
        lockParent={lockParent}
        parentId={parentId}
        parentTypeLabel={parentTypeLabel}
        lockedStatusSlot={
          status ? (
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex h-9 items-center">
                <WorkItemStatusBadge status={status} />
              </div>
            </div>
          ) : null
        }
        parentPickerSlot={
          showParentPicker ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="parent_id">Parent ({parentTypeLabel})</Label>
              <SearchableSelect
                id="parent_id"
                value={parentId}
                onValueChange={onParentIdChange}
                showClear
                disabled={!projectId || parentOptionsLoading}
                placeholder={
                  parentOptionsLoading
                    ? 'Loading parents…'
                    : `Search ${parentTypeLabel}s…`
                }
                options={parentOptions}
                emptyText="No matching parent work items."
              />
              <input type="hidden" name="parent_id" value={parentId} />
              <p className="text-muted-foreground text-xs">
                Optional. Same project only; hierarchy rules prevent invalid
                links and cycles.
              </p>
            </div>
          ) : null
        }
      />

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

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="labels">Labels</Label>
        <WorkItemLabelsInput value={labels} onChange={setLabels} />
      </div>
    </div>
  );
}
