'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  workItemTypeDisplayName,
  type WorkItemPriority,
  type WorkItemType,
} from '@repo/types';
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
  CircleDashed,
  CircleUserRound,
  FolderKanban,
  GitBranch,
  Hash,
  Layers,
  Plus,
  RefreshCw,
  Signal,
  Tag,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/searchable-select';
import type {
  WorkItemFormMember,
  WorkItemFormSharedFieldProps,
} from '@/app/work-items/_components/work-item-form/work-item-form-field-props';
import {
  isWorkItemFormDetailLayout,
  type WorkItemFormDialogLayout,
} from '@/app/work-items/_components/work-item-form/work-item-form-dialog-layout';
import {
  resolveShowParentPicker,
  WorkItemFormParentStatusSection,
} from '@/app/work-items/_components/work-item-form/work-item-form-parent-status';
import { WorkItemFormTypeSelect } from '@/app/work-items/_components/work-item-form/work-item-form-type-select';
import { WorkItemFormModernDescription } from '@/app/work-items/_components/work-item-form/work-item-form-modern-description';
import { WorkItemLabelsInput } from '@/app/work-items/_components/work-item-labels/work-item-labels-input';
import { WorkItemPrioritySelect } from '@/app/work-items/_components/work-item-priority-select';
import { WorkItemStatusBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-status';
import { workItemTypeIcon } from '@/app/work-items/_helpers/work-item-type';
import { MODERN_BORDERLESS_FOCUS_CLASSES } from '@/lib/editor/compact-editor-attrs';
import {
  isOptionsLoadingEmpty,
  loadingAwarePlaceholder,
} from '@/app/work-items/_helpers/work-item-form-loading-placeholder';
import {
  resolveSprintDisplayName,
  type WorkItemSprintOption,
} from '@/app/work-items/_helpers/work-item-sprint';
import { toDateInputValue } from '@/app/work-items/_helpers/work-item-due-date';

export type WorkItemFormModernFieldsProps = WorkItemFormSharedFieldProps & {
  readonly titleDefault?: string;
  readonly dueDateDefault?: string;
  readonly lockDueDate?: boolean;
  readonly storyPointsDefault?: number | null;
  readonly labelsDefault?: readonly string[];
  readonly descriptionDefault?: unknown;
  /** Expanded dialog uses vertical label+control rows (Jira create detail). */
  readonly dialogLayout?: WorkItemFormDialogLayout;
};

type OptionalField = 'priority' | 'story_points' | 'labels';

function initialOptionalFields(options: {
  readonly storyPointsDefault: number | null;
  readonly labelsDefault: readonly string[];
  readonly hasExplicitPriority: boolean;
}): Set<OptionalField> {
  const fields = new Set<OptionalField>();
  if (options.hasExplicitPriority) {
    fields.add('priority');
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
  { id: 'story_points', label: 'Story points' },
  { id: 'labels', label: 'Labels' },
];

function pillTriggerClassName(hasValue: boolean, detail = false) {
  return cn(
    'h-8 w-full min-w-0 gap-1.5 rounded-md px-2.5 text-xs font-normal shadow-none',
    detail
      ? 'border-transparent bg-transparent hover:bg-muted/50'
      : 'border-border bg-background hover:bg-muted/50 border',
    hasValue ? 'text-foreground' : 'text-muted-foreground'
  );
}

/** Compact attribute grid: uniform pill widths across 2–3 columns. */
const MODERN_FIELD_GRID_CLASS =
  'grid grid-cols-2 items-start gap-2 sm:grid-cols-3';

/** Expanded attribute list: icon + name + control, top to bottom. */
const MODERN_FIELD_DETAIL_CLASS = 'space-y-0.5';

function DetailFieldRow({
  icon,
  label,
  children,
}: Readonly<{
  icon: ReactNode;
  label: string;
  children: ReactNode;
}>) {
  return (
    <div className="hover:bg-muted/30 flex min-h-10 items-center gap-3 rounded-md px-1 py-1">
      <div className="text-muted-foreground flex w-44 shrink-0 items-center gap-2 text-sm">
        <span className="flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
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
  isLoading = false,
  showClear = false,
  detail = false,
  hideLeadingIcon = false,
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
  isLoading?: boolean;
  showClear?: boolean;
  detail?: boolean;
  hideLeadingIcon?: boolean;
}>) {
  const showIcon = !hideLeadingIcon;
  return (
    <div className="relative w-full min-w-0">
      {showIcon ? (
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 [&_svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      <SearchableSelect
        id={id}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        placeholder={placeholder}
        ariaLabel={placeholder}
        options={options}
        emptyText={emptyText}
        isLoading={isLoading}
        showClear={showClear}
        className={cn(
          pillTriggerClassName(Boolean(value), detail),
          showIcon && 'pl-8'
        )}
      />
      <input type="hidden" name={id} value={value} />
    </div>
  );
}

function isWorkItemType(value: string): value is WorkItemType {
  return value.trim().length > 0;
}

function resolveModernContextLabel(
  projects: WorkItemFormSharedFieldProps['projects'],
  projectId: string
): string | null {
  const selectedProject = projects.find((project) => project.id === projectId);
  if (!selectedProject) {
    return null;
  }
  return selectedProject.key
    ? `${selectedProject.key} · ${selectedProject.name}`
    : selectedProject.name;
}

function ModernFormContextBreadcrumb({
  contextLabel,
  type,
  typeDefs,
}: Readonly<{
  contextLabel: string | null;
  type: string;
  typeDefs: WorkItemFormSharedFieldProps['typeDefs'];
}>) {
  const TypeIcon = type && isWorkItemType(type) ? workItemTypeIcon(type) : null;
  const typeLabel = type ? workItemTypeDisplayName(type, typeDefs) : null;

  return (
    // Always reserve breadcrumb height so the dialog close control never covers title.
    <div className="text-muted-foreground flex min-h-7 items-center gap-1.5 pr-28 text-xs">
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
          !(contextLabel || typeLabel) && 'invisible'
        )}
        aria-hidden
      />
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium capitalize',
          typeLabel ? 'bg-muted/60 text-foreground' : 'invisible'
        )}
        aria-hidden={!typeLabel}
      >
        {TypeIcon ? <TypeIcon className="size-3.5 shrink-0" /> : null}
        {typeLabel || 'Type'}
      </span>
    </div>
  );
}

function ModernSprintField({
  sprintId,
  sprintOptions,
  projectId,
  lockSprintFromParent,
  onSprintIdChange,
  sprintOptionsLoading,
  detail = false,
}: Readonly<{
  readonly sprintId: string;
  readonly sprintOptions: readonly WorkItemSprintOption[];
  readonly sprintOptionsLoading: boolean;
  readonly projectId: string;
  readonly lockSprintFromParent: boolean;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onSprintIdChange: (value: string) => void;
  readonly detail?: boolean;
}>) {
  const loadingEmpty = isOptionsLoadingEmpty(
    sprintOptionsLoading,
    sprintOptions.length
  );
  const control = lockSprintFromParent ? (
    <span className="text-sm font-medium">
      {resolveSprintDisplayName(sprintId, sprintOptions)}
    </span>
  ) : (
    <IconSearchablePill
      icon={<RefreshCw />}
      id="sprint_id"
      value={sprintId}
      onValueChange={onSprintIdChange}
      disabled={!projectId}
      showClear
      detail={detail}
      hideLeadingIcon={detail}
      placeholder={loadingAwarePlaceholder(loadingEmpty, 'Loading…', 'Sprint')}
      options={sprintOptions.map((sprint) => ({
        value: sprint.id,
        label: sprint.name,
      }))}
      emptyText="No matching sprints."
      isLoading={loadingEmpty}
    />
  );

  if (detail) {
    return (
      <>
        <DetailFieldRow icon={<RefreshCw />} label="Sprint">
          {control}
        </DetailFieldRow>
        {lockSprintFromParent ? (
          <input type="hidden" name="sprint_id" value={sprintId} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <FieldTooltip
        label={lockSprintFromParent ? 'Sprint (from parent)' : 'Sprint'}
      >
        {control}
      </FieldTooltip>
      {lockSprintFromParent ? (
        <input type="hidden" name="sprint_id" value={sprintId} />
      ) : null}
    </>
  );
}

function ModernAssigneeField({
  assigneeId,
  projectMembers,
  lockAssignee,
  assigneeOptionsLoading,
  onAssigneeIdChange,
  detail = false,
}: Readonly<{
  readonly assigneeId: string;
  readonly projectMembers: readonly WorkItemFormMember[];
  readonly lockAssignee: boolean;
  readonly assigneeOptionsLoading: boolean;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onAssigneeIdChange: (value: string) => void;
  readonly detail?: boolean;
}>) {
  const loadingEmpty = isOptionsLoadingEmpty(
    assigneeOptionsLoading,
    projectMembers.length
  );
  const control = (
    <IconSearchablePill
      icon={<CircleUserRound />}
      id="assignee_id"
      value={assigneeId}
      onValueChange={onAssigneeIdChange}
      disabled={lockAssignee}
      detail={detail}
      hideLeadingIcon={detail}
      placeholder={loadingAwarePlaceholder(
        loadingEmpty,
        'Loading…',
        'Assignee'
      )}
      options={projectMembers.map((member) => ({
        value: member.id,
        label: member.name,
      }))}
      emptyText="No matching assignees."
      isLoading={loadingEmpty}
    />
  );

  if (detail) {
    return (
      <DetailFieldRow icon={<CircleUserRound />} label="Assignee">
        {control}
      </DetailFieldRow>
    );
  }

  return <FieldTooltip label="Assignee">{control}</FieldTooltip>;
}

/**
 * Linear/Jira-style create fields: title, description, then either compact
 * property pills or an expanded vertical label+control list.
 * Shares the same FormData field names as the classic create form.
 * Validation is server/Zod-only — no HTML `required` attributes.
 */
export function WorkItemFormModernFields({
  projects,
  projectMembers,
  availableTypes,
  typeDefs,
  projectId,
  assigneeId,
  sprintId,
  sprintOptions,
  sprintOptionsLoading,
  assigneeOptionsLoading,
  type,
  priority,
  parentId,
  parentOptions,
  parentOptionsLoading,
  parentTypeLabel,
  lockParent,
  lockSprintFromParent,
  lockProject,
  lockAssignee,
  typeLocked,
  lockStatus,
  status,
  onProjectIdChange,
  onAssigneeIdChange,
  onSprintIdChange,
  onTypeChange,
  onPriorityChange,
  onParentIdChange,
  titleDefault = '',
  dueDateDefault = '',
  lockDueDate = false,
  storyPointsDefault = null,
  labelsDefault = [],
  descriptionDefault = null,
  dialogLayout = 'center',
}: Readonly<WorkItemFormModernFieldsProps>) {
  const dueDateValue = toDateInputValue(dueDateDefault);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [descriptionJson, setDescriptionJson] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>(() => [...labelsDefault]);
  const [optionalFields, setOptionalFields] = useState<
    ReadonlySet<OptionalField>
  >(() =>
    initialOptionalFields({
      storyPointsDefault,
      labelsDefault,
      hasExplicitPriority: Boolean(titleDefault),
    })
  );
  const showParentPicker = resolveShowParentPicker(lockParent, parentTypeLabel);
  const detail = isWorkItemFormDetailLayout(dialogLayout);

  const handleDescriptionChange = useCallback((json: string | null) => {
    setDescriptionJson(json);
  }, []);

  useEffect(() => {
    const input = titleInputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, []);

  const addOptionalField = (field: OptionalField) => {
    setOptionalFields((current) => new Set(current).add(field));
  };

  const remainingOptional = OPTIONAL_FIELD_OPTIONS.filter(
    (option) => !optionalFields.has(option.id)
  );

  const contextLabel = resolveModernContextLabel(projects, projectId);
  const projectOptions = projects.map((project) => ({
    value: project.id,
    label: project.key ? `${project.key} · ${project.name}` : project.name,
  }));

  const projectControl = (
    <IconSearchablePill
      icon={<FolderKanban />}
      id="project_id"
      value={projectId}
      onValueChange={onProjectIdChange}
      disabled={lockProject}
      detail={detail}
      hideLeadingIcon={detail}
      placeholder="Project"
      options={projectOptions}
      emptyText="No matching projects."
    />
  );

  const typeControl = (
    <WorkItemFormTypeSelect
      type={type}
      onTypeChange={onTypeChange}
      availableTypes={availableTypes}
      typeDefs={typeDefs}
      typeLocked={typeLocked}
      triggerClassName={pillTriggerClassName(Boolean(type), detail)}
      placeholder="Type"
      aria-label="Type"
      showOptionIcons={false}
    />
  );

  const TypeIcon = type && isWorkItemType(type) ? workItemTypeIcon(type) : null;

  const statusSlot =
    status != null && status !== '' ? (
      <div className="flex h-8 w-full items-center">
        <WorkItemStatusBadge status={status} />
      </div>
    ) : null;

  const parentControl = showParentPicker ? (
    <IconSearchablePill
      icon={<GitBranch />}
      id="parent_id"
      value={parentId}
      onValueChange={onParentIdChange}
      disabled={!projectId || parentOptionsLoading}
      showClear
      detail={detail}
      hideLeadingIcon={detail}
      placeholder={
        parentOptionsLoading ? 'Parent…' : `Parent ${parentTypeLabel}`
      }
      options={parentOptions}
      emptyText="No matching parents."
    />
  ) : null;

  const priorityControl = (
    <WorkItemPrioritySelect
      priority={priority}
      onPriorityChange={onPriorityChange}
      placeholder="Priority"
      triggerClassName={pillTriggerClassName(Boolean(priority), detail)}
      triggerStart={
        detail ? undefined : (
          <Signal className="text-muted-foreground size-3.5 shrink-0" />
        )
      }
    />
  );

  const storyPointsControl = (
    <div className="relative w-full min-w-0">
      {detail ? null : (
        <Hash className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
      )}
      <Input
        id="story_points"
        name="story_points"
        type="number"
        min="0"
        step="1"
        placeholder={detail ? 'Story point estimate' : 'Points'}
        aria-label="Story points"
        defaultValue={storyPointsDefault ?? undefined}
        className={cn(
          pillTriggerClassName(false, detail),
          !detail && 'pr-2 pl-8'
        )}
      />
    </div>
  );

  const labelsControl = (
    <WorkItemLabelsInput value={labels} onChange={setLabels} />
  );

  const attributeProps: ModernAttributeFieldsProps = {
    detail,
    projectControl,
    typeControl,
    typeIcon: TypeIcon ? <TypeIcon /> : <Layers className="opacity-50" />,
    statusSlot,
    parentControl,
    parentTypeLabel,
    lockStatus,
    status,
    lockParent,
    parentId,
    assigneeId,
    projectMembers,
    lockAssignee,
    assigneeOptionsLoading,
    onAssigneeIdChange,
    sprintId,
    sprintOptions,
    sprintOptionsLoading,
    projectId,
    lockSprintFromParent,
    onSprintIdChange,
    dueDateValue,
    lockDueDate,
    priority,
    priorityControl,
    storyPointsControl,
    labelsControl,
    optionalFields,
    remainingOptional,
    onAddOptionalField: addOptionalField,
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <ModernFormContextBreadcrumb
          contextLabel={contextLabel}
          type={type}
          typeDefs={typeDefs}
        />

        <Input
          ref={titleInputRef}
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

        {detail ? (
          <ModernDetailAttributeList {...attributeProps} />
        ) : (
          <ModernCompactAttributeGrid {...attributeProps} />
        )}
      </div>
    </TooltipProvider>
  );
}

type ModernAttributeFieldsProps = {
  readonly detail: boolean;
  readonly projectControl: ReactNode;
  readonly typeControl: ReactNode;
  readonly typeIcon: ReactNode;
  readonly statusSlot: ReactNode;
  readonly parentControl: ReactNode;
  readonly parentTypeLabel: string | null;
  readonly lockStatus: boolean;
  readonly status: WorkItemFormSharedFieldProps['status'];
  readonly lockParent: boolean;
  readonly parentId: string;
  readonly assigneeId: string;
  readonly projectMembers: readonly WorkItemFormMember[];
  readonly lockAssignee: boolean;
  readonly assigneeOptionsLoading: boolean;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onAssigneeIdChange: (value: string) => void;
  readonly sprintId: string;
  readonly sprintOptions: readonly WorkItemSprintOption[];
  readonly sprintOptionsLoading: boolean;
  readonly projectId: string;
  readonly lockSprintFromParent: boolean;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onSprintIdChange: (value: string) => void;
  readonly dueDateValue: string;
  readonly lockDueDate: boolean;
  readonly priority: WorkItemPriority;
  readonly priorityControl: ReactNode;
  readonly storyPointsControl: ReactNode;
  readonly labelsControl: ReactNode;
  readonly optionalFields: ReadonlySet<OptionalField>;
  readonly remainingOptional: typeof OPTIONAL_FIELD_OPTIONS;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onAddOptionalField: (field: OptionalField) => void;
};

function ModernDetailAttributeList({
  projectControl,
  typeControl,
  typeIcon,
  statusSlot,
  parentControl,
  parentTypeLabel,
  lockStatus,
  status,
  lockParent,
  parentId,
  assigneeId,
  projectMembers,
  lockAssignee,
  assigneeOptionsLoading,
  onAssigneeIdChange,
  sprintId,
  sprintOptions,
  sprintOptionsLoading,
  projectId,
  lockSprintFromParent,
  onSprintIdChange,
  dueDateValue,
  lockDueDate,
  priorityControl,
  storyPointsControl,
  labelsControl,
}: Readonly<ModernAttributeFieldsProps>) {
  return (
    <div className={MODERN_FIELD_DETAIL_CLASS}>
      <DetailFieldRow icon={<FolderKanban />} label="Project">
        {projectControl}
      </DetailFieldRow>
      <DetailFieldRow icon={typeIcon} label="Type">
        {typeControl}
      </DetailFieldRow>
      <WorkItemFormParentStatusSection
        lockStatus={lockStatus}
        status={status}
        lockParent={lockParent}
        parentId={parentId}
        parentTypeLabel={parentTypeLabel}
        lockedStatusSlot={
          statusSlot ? (
            <DetailFieldRow icon={<CircleDashed />} label="Status">
              {statusSlot}
            </DetailFieldRow>
          ) : null
        }
        parentPickerSlot={
          parentControl ? (
            <DetailFieldRow icon={<GitBranch />} label="Parent">
              {parentControl}
            </DetailFieldRow>
          ) : null
        }
      />
      <ModernAssigneeField
        assigneeId={assigneeId}
        projectMembers={projectMembers}
        lockAssignee={lockAssignee}
        assigneeOptionsLoading={assigneeOptionsLoading}
        onAssigneeIdChange={onAssigneeIdChange}
        detail
      />
      <ModernSprintField
        sprintId={sprintId}
        sprintOptions={sprintOptions}
        sprintOptionsLoading={sprintOptionsLoading}
        projectId={projectId}
        lockSprintFromParent={lockSprintFromParent}
        onSprintIdChange={onSprintIdChange}
        detail
      />
      <ModernDueDateField
        dueDateDefault={dueDateValue}
        lockDueDate={lockDueDate}
        detail
      />
      <DetailFieldRow icon={<Signal />} label="Priority">
        {priorityControl}
      </DetailFieldRow>
      <DetailFieldRow icon={<Hash />} label="Story point estimate">
        {storyPointsControl}
      </DetailFieldRow>
      <DetailFieldRow icon={<Tag />} label="Labels">
        {labelsControl}
      </DetailFieldRow>
    </div>
  );
}

function ModernCompactAttributeGrid({
  projectControl,
  typeControl,
  statusSlot,
  parentControl,
  parentTypeLabel,
  lockStatus,
  status,
  lockParent,
  parentId,
  assigneeId,
  projectMembers,
  lockAssignee,
  assigneeOptionsLoading,
  onAssigneeIdChange,
  sprintId,
  sprintOptions,
  sprintOptionsLoading,
  projectId,
  lockSprintFromParent,
  onSprintIdChange,
  dueDateValue,
  lockDueDate,
  priority,
  priorityControl,
  storyPointsControl,
  labelsControl,
  optionalFields,
  remainingOptional,
  onAddOptionalField,
}: Readonly<ModernAttributeFieldsProps>) {
  return (
    <div className="space-y-2">
      <div className={MODERN_FIELD_GRID_CLASS}>
        <FieldTooltip label="Project">{projectControl}</FieldTooltip>
        <FieldTooltip label="Type">
          <div className="w-full min-w-0">{typeControl}</div>
        </FieldTooltip>
        <WorkItemFormParentStatusSection
          lockStatus={lockStatus}
          status={status}
          lockParent={lockParent}
          parentId={parentId}
          parentTypeLabel={parentTypeLabel}
          lockedStatusSlot={
            statusSlot ? (
              <FieldTooltip label="Status">{statusSlot}</FieldTooltip>
            ) : null
          }
          parentPickerSlot={
            parentControl ? (
              <FieldTooltip label={`Parent (${parentTypeLabel})`}>
                {parentControl}
              </FieldTooltip>
            ) : null
          }
        />
        <ModernAssigneeField
          assigneeId={assigneeId}
          projectMembers={projectMembers}
          lockAssignee={lockAssignee}
          assigneeOptionsLoading={assigneeOptionsLoading}
          onAssigneeIdChange={onAssigneeIdChange}
        />
        <ModernSprintField
          sprintId={sprintId}
          sprintOptions={sprintOptions}
          sprintOptionsLoading={sprintOptionsLoading}
          projectId={projectId}
          lockSprintFromParent={lockSprintFromParent}
          onSprintIdChange={onSprintIdChange}
        />
        <ModernDueDateField
          dueDateDefault={dueDateValue}
          lockDueDate={lockDueDate}
        />
        {optionalFields.has('priority') ? (
          <FieldTooltip label="Priority">
            <div className="w-full min-w-0">{priorityControl}</div>
          </FieldTooltip>
        ) : (
          <input type="hidden" name="priority" value={priority} />
        )}
        {optionalFields.has('story_points') ? (
          <FieldTooltip label="Story points">{storyPointsControl}</FieldTooltip>
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
      </div>
      {optionalFields.has('labels') ? (
        <div className="space-y-1.5">
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <Tag className="size-3.5" />
            Labels
          </div>
          {labelsControl}
        </div>
      ) : null}
    </div>
  );
}

function ModernDueDateField({
  dueDateDefault,
  lockDueDate,
  detail = false,
}: Readonly<{
  dueDateDefault: string;
  lockDueDate: boolean;
  detail?: boolean;
}>) {
  const control = (
    <div className="relative w-full min-w-0">
      {detail ? null : (
        <Calendar className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
      )}
      <Input
        id="due_date"
        name="due_date"
        type="date"
        aria-label="Due date"
        defaultValue={dueDateDefault}
        disabled={lockDueDate}
        className={cn(
          pillTriggerClassName(Boolean(dueDateDefault), detail),
          !detail && 'pr-2 pl-8'
        )}
      />
    </div>
  );

  if (detail) {
    return (
      <DetailFieldRow icon={<Calendar />} label="Due date">
        {control}
      </DetailFieldRow>
    );
  }

  return <FieldTooltip label="Due date">{control}</FieldTooltip>;
}
