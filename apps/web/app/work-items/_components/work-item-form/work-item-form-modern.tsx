'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { type WorkItemPriority, type WorkItemType } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  Calendar,
  ChevronRight,
  CircleUserRound,
  FolderKanban,
  GitBranch,
  Hash,
  Layers,
  Plus,
  Signal,
  Tag,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/searchable-select';
import type { WorkItemFormSharedFieldProps } from '@/app/work-items/_components/work-item-form/work-item-form-field-props';
import {
  resolveShowParentPicker,
  WorkItemFormParentStatusSection,
} from '@/app/work-items/_components/work-item-form/work-item-form-parent-status';
import { WorkItemFormTypeSelect } from '@/app/work-items/_components/work-item-form/work-item-form-type-select';
import { WorkItemFormModernDescription } from '@/app/work-items/_components/work-item-form/work-item-form-modern-description';
import { WorkItemLabelsInput } from '@/app/work-items/_components/work-item-labels/work-item-labels-input';
import { WorkItemPrioritySelect } from '@/app/work-items/_components/work-item-priority-select';
import { WorkItemStatusBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-status';
import { WORK_ITEM_TYPE_ICONS } from '@/app/work-items/_helpers/work-item-type';
import { MODERN_BORDERLESS_FOCUS_CLASSES } from '@/lib/editor/compact-editor-attrs';

export type WorkItemFormModernFieldsProps = WorkItemFormSharedFieldProps & {
  readonly titleDefault?: string;
  readonly dueDateDefault?: string;
  readonly lockDueDate?: boolean;
  readonly storyPointsDefault?: number | null;
  readonly labelsDefault?: readonly string[];
  readonly descriptionDefault?: unknown;
};

type OptionalField = 'priority' | 'due_date' | 'story_points' | 'labels';

function toDateInputValue(value: string): string {
  return value.split('T')[0] ?? '';
}

function initialOptionalFields(options: {
  readonly dueDateDefault: string;
  readonly lockDueDate: boolean;
  readonly storyPointsDefault: number | null;
  readonly labelsDefault: readonly string[];
  readonly hasExplicitPriority: boolean;
}): Set<OptionalField> {
  const fields = new Set<OptionalField>();
  if (options.hasExplicitPriority) {
    fields.add('priority');
  }
  if (toDateInputValue(options.dueDateDefault) || options.lockDueDate) {
    fields.add('due_date');
  }
  if (options.storyPointsDefault != null) {
    fields.add('story_points');
  }
  if (options.labelsDefault.length > 0) {
    fields.add('labels');
  }
  return fields;
}

const OPTIONAL_FIELD_OPTIONS: ReadonlyArray<{
  readonly id: OptionalField;
  readonly label: string;
}> = [
  { id: 'priority', label: 'Priority' },
  { id: 'due_date', label: 'Due date' },
  { id: 'story_points', label: 'Story points' },
  { id: 'labels', label: 'Labels' },
];

function pillTriggerClassName(hasValue: boolean) {
  return cn(
    'border-border bg-background hover:bg-muted/50 h-8 w-auto min-w-0 gap-1.5 rounded-md border px-2.5 text-xs font-normal shadow-none',
    hasValue ? 'text-foreground' : 'text-muted-foreground'
  );
}

function FieldTooltip({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function IconSearchablePill({
  icon,
  id,
  value,
  onValueChange,
  disabled,
  placeholder,
  options,
  emptyText,
  showClear = false,
}: Readonly<{
  icon: ReactNode;
  id: string;
  value: string;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder: string;
  options: readonly SearchableSelectOption[];
  emptyText: string;
  showClear?: boolean;
}>) {
  return (
    <div className="relative min-w-40 flex-1 sm:max-w-56">
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 [&_svg]:size-3.5">
        {icon}
      </span>
      <SearchableSelect
        id={id}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        placeholder={placeholder}
        ariaLabel={placeholder}
        options={options}
        emptyText={emptyText}
        showClear={showClear}
        className={cn(pillTriggerClassName(Boolean(value)), 'pl-8')}
      />
      <input type="hidden" name={id} value={value} />
    </div>
  );
}

function isWorkItemType(value: string): value is WorkItemType {
  return value in WORK_ITEM_TYPE_ICONS;
}

/**
 * Linear/Jira-style create fields: title, description, property pills.
 * Shares the same FormData field names as the classic create form.
 * Validation is server/Zod-only — no HTML `required` attributes.
 */
export function WorkItemFormModernFields({
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
  onProjectIdChange,
  onAssigneeIdChange,
  onTypeChange,
  onPriorityChange,
  onParentIdChange,
  titleDefault = '',
  dueDateDefault = '',
  lockDueDate = false,
  storyPointsDefault = null,
  labelsDefault = [],
  descriptionDefault = null,
}: Readonly<WorkItemFormModernFieldsProps>) {
  const dueDateValue = toDateInputValue(dueDateDefault);
  const [descriptionJson, setDescriptionJson] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>(() => [...labelsDefault]);
  const [optionalFields, setOptionalFields] = useState<
    ReadonlySet<OptionalField>
  >(() =>
    initialOptionalFields({
      dueDateDefault,
      lockDueDate,
      storyPointsDefault,
      labelsDefault,
      hasExplicitPriority: Boolean(titleDefault),
    })
  );
  const showParentPicker = resolveShowParentPicker(lockParent, parentTypeLabel);

  const handleDescriptionChange = useCallback((json: string | null) => {
    setDescriptionJson(json);
  }, []);

  const addOptionalField = (field: OptionalField) => {
    setOptionalFields((current) => new Set(current).add(field));
  };

  const remainingOptional = OPTIONAL_FIELD_OPTIONS.filter(
    (option) =>
      !optionalFields.has(option.id) &&
      !(lockDueDate && option.id === 'due_date')
  );

  const selectedProject = projects.find((project) => project.id === projectId);
  let contextLabel: string | null = null;
  if (selectedProject) {
    contextLabel = selectedProject.key
      ? `${selectedProject.key} · ${selectedProject.name}`
      : selectedProject.name;
  }

  const TypeIcon =
    type && isWorkItemType(type) ? WORK_ITEM_TYPE_ICONS[type] : null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Always reserve breadcrumb height so the dialog close control never covers title. */}
        <div className="text-muted-foreground flex min-h-7 items-center gap-1.5 pr-10 text-xs">
          <TruncatedText
            className={cn(
              'inline-flex max-w-48 items-center rounded-md px-2 py-1 font-medium',
              contextLabel ? 'bg-muted/60 text-foreground' : 'invisible'
            )}
            aria-hidden={!contextLabel}
          >
            {contextLabel || 'Project'}
          </TruncatedText>
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0',
              !(contextLabel || type) && 'invisible'
            )}
            aria-hidden
          />
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium capitalize',
              type ? 'bg-muted/60 text-foreground' : 'invisible'
            )}
            aria-hidden={!type}
          >
            {TypeIcon ? <TypeIcon className="size-3.5 shrink-0" /> : null}
            {type || 'Type'}
          </span>
        </div>

        <Input
          id="title"
          name="title"
          placeholder="Title"
          aria-label="Title"
          defaultValue={titleDefault}
          className={cn(
            'placeholder:text-muted-foreground/70 h-auto rounded-md bg-transparent! pr-10 pl-3 text-2xl! font-semibold',
            MODERN_BORDERLESS_FOCUS_CLASSES
          )}
        />

        <WorkItemFormModernDescription
          initialContent={descriptionDefault}
          onJsonChange={handleDescriptionChange}
        />
        {descriptionJson ? (
          <input type="hidden" name="description" value={descriptionJson} />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <FieldTooltip label="Project">
            <IconSearchablePill
              icon={<FolderKanban />}
              id="project_id"
              value={projectId}
              onValueChange={onProjectIdChange}
              disabled={lockProject}
              placeholder="Project"
              options={projects.map((project) => ({
                value: project.id,
                label: project.key
                  ? `${project.key} · ${project.name}`
                  : project.name,
              }))}
              emptyText="No matching projects."
            />
          </FieldTooltip>

          <FieldTooltip label="Type">
            <div>
              <WorkItemFormTypeSelect
                type={type}
                onTypeChange={onTypeChange}
                availableTypes={availableTypes}
                typeLocked={typeLocked}
                triggerClassName={pillTriggerClassName(Boolean(type))}
                placeholder="Type"
                aria-label="Type"
                triggerStart={
                  <Layers className="text-muted-foreground size-3.5 shrink-0" />
                }
              />
            </div>
          </FieldTooltip>

          <WorkItemFormParentStatusSection
            lockStatus={lockStatus}
            status={status}
            lockParent={lockParent}
            parentId={parentId}
            parentTypeLabel={parentTypeLabel}
            lockedStatusSlot={
              status ? (
                <FieldTooltip label="Status">
                  <div className="flex h-8 items-center">
                    <WorkItemStatusBadge status={status} />
                  </div>
                </FieldTooltip>
              ) : null
            }
            parentPickerSlot={
              showParentPicker ? (
                <FieldTooltip label={`Parent (${parentTypeLabel})`}>
                  <IconSearchablePill
                    icon={<GitBranch />}
                    id="parent_id"
                    value={parentId}
                    onValueChange={onParentIdChange}
                    disabled={!projectId || parentOptionsLoading}
                    showClear
                    placeholder={
                      parentOptionsLoading
                        ? 'Parent…'
                        : `Parent ${parentTypeLabel}`
                    }
                    options={parentOptions}
                    emptyText="No matching parents."
                  />
                </FieldTooltip>
              ) : null
            }
          />

          <FieldTooltip label="Assignee">
            <IconSearchablePill
              icon={<CircleUserRound />}
              id="assignee_id"
              value={assigneeId}
              onValueChange={onAssigneeIdChange}
              disabled={lockAssignee}
              placeholder="Assignee"
              options={projectMembers.map((member) => ({
                value: member.id,
                label: member.name,
              }))}
              emptyText="No matching assignees."
            />
          </FieldTooltip>

          <ModernOptionalFieldPills
            optionalFields={optionalFields}
            remainingOptional={remainingOptional}
            priority={priority}
            onPriorityChange={onPriorityChange}
            onAddOptionalField={addOptionalField}
            dueDateDefault={dueDateValue}
            lockDueDate={lockDueDate}
            storyPointsDefault={storyPointsDefault}
          />
        </div>

        {optionalFields.has('labels') ? (
          <div className="space-y-1.5">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
              <Tag className="size-3.5" />
              Labels
            </div>
            <WorkItemLabelsInput value={labels} onChange={setLabels} />
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

type ModernOptionalFieldPillsProps = {
  readonly optionalFields: ReadonlySet<OptionalField>;
  readonly remainingOptional: typeof OPTIONAL_FIELD_OPTIONS;
  readonly priority: WorkItemPriority;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onPriorityChange: (value: WorkItemPriority) => void;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onAddOptionalField: (field: OptionalField) => void;
  readonly dueDateDefault: string;
  readonly lockDueDate: boolean;
  readonly storyPointsDefault: number | null;
};

function ModernDueDateField({
  optionalFields,
  dueDateDefault,
  lockDueDate,
}: Readonly<{
  optionalFields: ReadonlySet<OptionalField>;
  dueDateDefault: string;
  lockDueDate: boolean;
}>) {
  if (optionalFields.has('due_date')) {
    return (
      <FieldTooltip label="Due date">
        <div className="relative">
          <Calendar className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            id="due_date"
            name="due_date"
            type="date"
            aria-label="Due date"
            defaultValue={dueDateDefault}
            disabled={lockDueDate}
            className={cn(pillTriggerClassName(false), 'w-38 pr-2 pl-8')}
          />
        </div>
      </FieldTooltip>
    );
  }

  if (lockDueDate && dueDateDefault) {
    return <input type="hidden" name="due_date" value={dueDateDefault} />;
  }

  return null;
}

function ModernOptionalFieldPills({
  optionalFields,
  remainingOptional,
  priority,
  onPriorityChange,
  onAddOptionalField,
  dueDateDefault,
  lockDueDate,
  storyPointsDefault,
}: Readonly<ModernOptionalFieldPillsProps>) {
  return (
    <>
      {optionalFields.has('priority') ? (
        <FieldTooltip label="Priority">
          <div>
            <WorkItemPrioritySelect
              priority={priority}
              onPriorityChange={onPriorityChange}
              placeholder="Priority"
              triggerClassName={pillTriggerClassName(Boolean(priority))}
              triggerStart={
                <Signal className="text-muted-foreground size-3.5 shrink-0" />
              }
            />
          </div>
        </FieldTooltip>
      ) : (
        <input type="hidden" name="priority" value={priority} />
      )}

      <ModernDueDateField
        optionalFields={optionalFields}
        dueDateDefault={dueDateDefault}
        lockDueDate={lockDueDate}
      />

      {optionalFields.has('story_points') ? (
        <FieldTooltip label="Story points">
          <div className="relative">
            <Hash className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              id="story_points"
              name="story_points"
              type="number"
              min="0"
              step="1"
              placeholder="Points"
              aria-label="Story points"
              defaultValue={storyPointsDefault ?? undefined}
              className={cn(pillTriggerClassName(false), 'w-26 pr-2 pl-8')}
            />
          </div>
        </FieldTooltip>
      ) : null}

      {remainingOptional.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="More fields"
              title="Add more fields"
              className={cn(
                pillTriggerClassName(false),
                'hover:bg-muted/50 h-8 gap-1 px-2.5'
              )}
            >
              <Plus className="size-3.5" />
              More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {remainingOptional.map((option) => (
              <DropdownMenuItem
                key={option.id}
                onSelect={() => onAddOptionalField(option.id)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  );
}
