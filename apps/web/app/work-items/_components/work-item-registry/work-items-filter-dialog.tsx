'use client';

import { useEffect, useMemo, useState } from 'react';
import { Constants } from '@repo/types/database';
import { cn } from '@repo/ui/lib/utils';
import {
  parseWorkItemLabelsFilterParam,
  WORK_ITEM_PRIORITIES,
} from '@repo/types';
import {
  applyProjectFilterToSearchParams,
  buildSprintFilterOptionsForQuery,
} from '@/app/board/_services/board.defaults.shared';
import type { WorkItemsFilterDraft } from '@/app/work-items/_components/work-item-table/work-item-table-helpers';
import type { FilterQuery } from '@/app/work-items/_components/work-item-table/work-items-table-types';
import type { WorkItemWorkspaceProps } from '@/app/work-items/_components/work-items-workspace';
import { resolveAssigneeFilterMembers } from '@/app/work-items/_helpers/work-item-assignee-filter-members';
import { WORK_ITEM_STATUSES } from '@/app/work-items/_helpers/work-item-status';
import { PRIORITY_LABELS } from '@/app/work-items/_helpers/work-item-priority-ui';
import { formatLabelWithSpace } from '@/app/_shared/utility';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';
import { WorkItemLabelsInput } from '@/app/work-items/_components/work-item-labels/work-item-labels-input';
import {
  FILTER_OPTIONS_SCROLL_CLASS,
  FilterDialogShell,
  FilterOptionsChecklistPane,
  type FilterDialogOption,
} from '@/components/filter-dialog-shell';

const WORK_ITEM_TYPES = Constants.public.Enums.WorkItemType;

/** Single-value draft fields updated by the same apply/clear path. */
const SCALAR_DRAFT_FILTER_KEYS = [
  'sprint',
  'assignee',
  'type',
  'priority',
] as const satisfies ReadonlyArray<keyof WorkItemsFilterDraft>;

type ScalarDraftFilterKey = (typeof SCALAR_DRAFT_FILTER_KEYS)[number];

function isScalarDraftFilterKey(id: string): id is ScalarDraftFilterKey {
  return (SCALAR_DRAFT_FILTER_KEYS as readonly string[]).includes(id);
}

function withDraftScalarField(
  draft: WorkItemsFilterDraft,
  fieldId: ScalarDraftFilterKey,
  value: string
): WorkItemsFilterDraft {
  return { ...draft, [fieldId]: value };
}

export type WorkItemsFilterFieldId =
  | 'project'
  | 'sprint'
  | 'assignee'
  | 'type'
  | 'status'
  | 'labels'
  | 'parent'
  | 'priority';

type FilterFieldConfig = {
  readonly id: WorkItemsFilterFieldId;
  readonly label: string;
  readonly searchPlaceholder: string;
  readonly wired: boolean;
};

const FILTER_FIELD_CONFIG: Record<WorkItemsFilterFieldId, FilterFieldConfig> = {
  project: {
    id: 'project',
    label: 'Project',
    searchPlaceholder: 'Search projects',
    wired: true,
  },
  sprint: {
    id: 'sprint',
    label: 'Sprint',
    searchPlaceholder: 'Search sprints',
    wired: true,
  },
  parent: {
    id: 'parent',
    label: 'Parent',
    searchPlaceholder: 'Search parent work items',
    wired: false,
  },
  assignee: {
    id: 'assignee',
    label: 'Assignee',
    searchPlaceholder: 'Search assignees',
    wired: true,
  },
  status: {
    id: 'status',
    label: 'Status',
    searchPlaceholder: 'Search statuses',
    wired: false,
  },
  type: {
    id: 'type',
    label: 'Work type',
    searchPlaceholder: 'Search work types',
    wired: true,
  },
  labels: {
    id: 'labels',
    label: 'Labels',
    searchPlaceholder: 'Add label',
    wired: true,
  },
  priority: {
    id: 'priority',
    label: 'Priority',
    searchPlaceholder: 'Search priorities',
    wired: true,
  },
};

/* eslint-disable no-unused-vars */
export type WorkItemsFilterDialogProps = {
  readonly projects: WorkItemWorkspaceProps['projects'];
  readonly projectMembers: WorkItemWorkspaceProps['projectMembers'];
  readonly projectMembersByProjectId?: NonNullable<
    WorkItemWorkspaceProps['projectMembersByProjectId']
  >;
  readonly sprints: WorkItemWorkspaceProps['sprints'];
  readonly projectQuery: FilterQuery;
  readonly sprintQuery: FilterQuery;
  readonly typeQuery: FilterQuery;
  readonly assigneeQuery: FilterQuery;
  readonly labelsQuery: FilterQuery;
  /** When set, enables the Priority field (e.g. board toolbar). */
  readonly priorityQuery?: FilterQuery;
  /**
   * Optional explicit field set. Board uses project/sprint/priority;
   * work-items list uses the default buildVisibleFields() set.
   */
  readonly visibleFieldIds?: readonly WorkItemsFilterFieldId[];
  readonly isProjectLocked: boolean;
  readonly isAssigneeLocked: boolean;
  readonly hasActiveFilters: boolean;
  readonly onApplyFilters: (draft: WorkItemsFilterDraft) => void;
};
/* eslint-enable no-unused-vars */

function buildVisibleFields(
  isProjectLocked: boolean,
  isAssigneeLocked: boolean,
  visibleFieldIds?: readonly WorkItemsFilterFieldId[]
): FilterFieldConfig[] {
  if (visibleFieldIds && visibleFieldIds.length > 0) {
    return visibleFieldIds.map((id) => FILTER_FIELD_CONFIG[id]);
  }

  const fields: FilterFieldConfig[] = [];

  if (!isProjectLocked) {
    fields.push(FILTER_FIELD_CONFIG.project);
  }

  // Sprint stays available when the project is locked (project Work Items tab).
  fields.push(FILTER_FIELD_CONFIG.sprint);

  fields.push(FILTER_FIELD_CONFIG.parent);

  if (!isAssigneeLocked) {
    fields.push(FILTER_FIELD_CONFIG.assignee);
  }

  fields.push(
    FILTER_FIELD_CONFIG.status,
    FILTER_FIELD_CONFIG.type,
    FILTER_FIELD_CONFIG.labels
  );

  return fields;
}

function optionsForField(
  fieldId: WorkItemsFilterFieldId,
  props: WorkItemsFilterDialogProps,
  draft: WorkItemsFilterDraft
): FilterDialogOption[] {
  switch (fieldId) {
    case 'project':
      return props.projects.map((project) => ({
        value: project.id,
        label: project.name,
      }));
    case 'sprint':
      return buildSprintFilterOptionsForQuery(
        props.sprints,
        draft.project,
        QUERY_FILTER_ALL_VALUE
      );
    case 'assignee': {
      if (props.projectMembersByProjectId) {
        const projectId = props.isProjectLocked
          ? props.projectQuery.value
          : draft.project;
        return resolveAssigneeFilterMembers({
          membersByProjectId: props.projectMembersByProjectId,
          projectId,
          allValue: QUERY_FILTER_ALL_VALUE,
        }).map((member) => ({
          value: member.id,
          label: member.name,
        }));
      }
      return props.projectMembers.map((member) => ({
        value: member.id,
        label: member.name,
      }));
    }
    case 'type':
      return WORK_ITEM_TYPES.map((workItemType) => ({
        value: workItemType,
        label: workItemType,
      }));
    case 'status':
      return WORK_ITEM_STATUSES.map((status) => ({
        value: status,
        label: formatLabelWithSpace(status),
      }));
    case 'priority':
      return [...WORK_ITEM_PRIORITIES].reverse().map((priority) => ({
        value: priority,
        label: PRIORITY_LABELS[priority],
      }));
    case 'labels':
      return [];
    case 'parent':
      return [{ value: '__none__', label: 'No parent' }];
    default:
      return [];
  }
}

function allLabelForField(fieldId: WorkItemsFilterFieldId): string {
  switch (fieldId) {
    case 'project':
      return 'All projects';
    case 'sprint':
      return 'All sprints';
    case 'assignee':
      return 'All assignees';
    case 'type':
      return 'All types';
    case 'priority':
      return 'All priorities';
    case 'labels':
      return 'No labels';
    default:
      return 'All';
  }
}

function labelsFromQuery(query: FilterQuery): string[] {
  if (!query.value || query.value === query.allValue) {
    return [];
  }
  return parseWorkItemLabelsFilterParam(query.value) ?? [];
}

function snapshotDraft(
  props: WorkItemsFilterDialogProps
): WorkItemsFilterDraft {
  return {
    project: props.projectQuery.value,
    sprint: props.sprintQuery.value,
    type: props.typeQuery.value,
    assignee: props.assigneeQuery.value,
    labels: labelsFromQuery(props.labelsQuery),
    priority: props.priorityQuery?.value ?? QUERY_FILTER_ALL_VALUE,
  };
}

function emptyDraft(props: WorkItemsFilterDialogProps): WorkItemsFilterDraft {
  const all = QUERY_FILTER_ALL_VALUE;
  return {
    project: props.isProjectLocked ? props.projectQuery.value : all,
    sprint: all,
    type: all,
    assignee: props.isAssigneeLocked ? props.assigneeQuery.value : all,
    labels: [],
    priority: all,
  };
}

function labelsSelectionSummary(count: number): string {
  if (count === 0) {
    return 'No label filters applied.';
  }
  if (count === 1) {
    return '1 label selected.';
  }
  return `${count} labels selected.`;
}

function FilterLabelsPane({
  selectedLabels,
  onChange,
}: Readonly<{
  selectedLabels: readonly string[];
  // eslint-disable-next-line no-unused-vars
  onChange: (labels: string[]) => void;
}>) {
  return (
    <>
      <div className="border-border border-b py-3 pr-12 pl-3">
        <p className="text-muted-foreground mb-2 text-xs">
          Add exact labels (case-sensitive). Items matching any label are
          included.
        </p>
        <WorkItemLabelsInput
          value={selectedLabels}
          onChange={onChange}
          placeholder="Add label and press Enter"
        />
      </div>
      <div
        className={cn(
          'text-muted-foreground flex flex-1 items-start p-3 text-sm',
          FILTER_OPTIONS_SCROLL_CLASS
        )}
      >
        {labelsSelectionSummary(selectedLabels.length)}
      </div>
    </>
  );
}

function selectedValueForField(
  field: FilterFieldConfig,
  draft: WorkItemsFilterDraft,
  placeholderSelections: Partial<Record<WorkItemsFilterFieldId, string>>
): string {
  if (!field.wired) {
    return placeholderSelections[field.id] ?? '';
  }
  switch (field.id) {
    case 'project':
      return draft.project;
    case 'sprint':
      return draft.sprint;
    case 'assignee':
      return draft.assignee;
    case 'type':
      return draft.type;
    case 'priority':
      return draft.priority;
    case 'labels':
      return '';
    default:
      return '';
  }
}

function countVisibleOptions(
  isLabelsField: boolean,
  selectedLabelsCount: number,
  filteredOptionsCount: number,
  showAllOption: boolean
): number {
  if (isLabelsField) {
    return selectedLabelsCount;
  }
  return filteredOptionsCount + (showAllOption ? 1 : 0);
}

function draftWithProjectChange(
  draft: WorkItemsFilterDraft,
  nextProject: string,
  sprints: WorkItemWorkspaceProps['sprints']
): WorkItemsFilterDraft {
  const params = new URLSearchParams();
  applyProjectFilterToSearchParams(params, {
    nextProject,
    sprints,
    allValue: QUERY_FILTER_ALL_VALUE,
    pageMode: 'one',
  });
  return {
    ...draft,
    project: nextProject,
    sprint: params.get('sprint') ?? QUERY_FILTER_ALL_VALUE,
    assignee: QUERY_FILTER_ALL_VALUE,
  };
}

export function WorkItemsFilterDialog(
  props: Readonly<WorkItemsFilterDialogProps>
) {
  const {
    isProjectLocked,
    isAssigneeLocked,
    hasActiveFilters,
    onApplyFilters,
    sprints,
    visibleFieldIds,
  } = props;

  const fields = useMemo(
    () =>
      buildVisibleFields(isProjectLocked, isAssigneeLocked, visibleFieldIds),
    [isAssigneeLocked, isProjectLocked, visibleFieldIds]
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WorkItemsFilterDraft>(() =>
    snapshotDraft(props)
  );
  const [activeFieldId, setActiveFieldId] = useState<WorkItemsFilterFieldId>(
    fields[0]?.id ?? 'type'
  );
  const [optionSearch, setOptionSearch] = useState('');
  const [placeholderSelections, setPlaceholderSelections] = useState<
    Partial<Record<WorkItemsFilterFieldId, string>>
  >({});

  const activeField =
    fields.find((field) => field.id === activeFieldId) ?? fields[0]!;

  useEffect(() => {
    if (!fields.some((field) => field.id === activeFieldId)) {
      setActiveFieldId(fields[0]?.id ?? 'type');
    }
  }, [activeFieldId, fields]);

  useEffect(() => {
    setOptionSearch('');
  }, [activeFieldId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft(snapshotDraft(props));
    setPlaceholderSelections({});
    // Seed once when the dialog opens; ignore prop churn while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition only
  }, [open]);

  const options = optionsForField(activeField.id, props, draft);
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(optionSearch.trim().toLowerCase())
  );

  const isLabelsField = activeField.id === 'labels';
  const selectedValue = selectedValueForField(
    activeField,
    draft,
    placeholderSelections
  );

  const applySelection = (value: string) => {
    if (!activeField.wired || activeField.id === 'labels') {
      if (!activeField.wired) {
        setPlaceholderSelections((current) => ({
          ...current,
          [activeField.id]: value,
        }));
      }
      return;
    }

    if (activeField.id === 'project') {
      setDraft((current) => draftWithProjectChange(current, value, sprints));
      return;
    }

    if (isScalarDraftFilterKey(activeField.id)) {
      const fieldId = activeField.id;
      setDraft((current) => withDraftScalarField(current, fieldId, value));
    }
  };

  const clearActiveField = () => {
    if (!activeField.wired) {
      setPlaceholderSelections((current) => {
        const next = { ...current };
        delete next[activeField.id];
        return next;
      });
      return;
    }

    if (activeField.id === 'labels') {
      setDraft((current) => ({ ...current, labels: [] }));
      return;
    }

    if (activeField.id === 'project') {
      setDraft((current) =>
        draftWithProjectChange(current, QUERY_FILTER_ALL_VALUE, sprints)
      );
      return;
    }

    if (isScalarDraftFilterKey(activeField.id)) {
      const fieldId = activeField.id;
      setDraft((current) =>
        withDraftScalarField(current, fieldId, QUERY_FILTER_ALL_VALUE)
      );
    }
  };

  const handleClearAllDraft = () => {
    setDraft(emptyDraft(props));
    setPlaceholderSelections({});
  };

  const handleOkay = () => {
    onApplyFilters(draft);
    setOpen(false);
  };

  const showAllOption = Boolean(!isLabelsField && activeField.wired);
  const visibleCount = countVisibleOptions(
    isLabelsField,
    draft.labels.length,
    filteredOptions.length,
    showAllOption
  );
  const footerCountLabel = isLabelsField
    ? `${visibleCount} selected`
    : `${visibleCount} of ${visibleCount}`;

  let fieldPane = (
    <FilterOptionsChecklistPane
      fieldId={activeField.id}
      searchPlaceholder={activeField.searchPlaceholder}
      optionSearch={optionSearch}
      onOptionSearchChange={setOptionSearch}
      filteredOptions={filteredOptions}
      showAllOption={showAllOption}
      allOptionLabel={allLabelForField(activeField.id)}
      selectedValue={selectedValue}
      allValue={QUERY_FILTER_ALL_VALUE}
      onApplySelection={applySelection}
      onClearActiveField={clearActiveField}
    />
  );
  if (isLabelsField) {
    fieldPane = (
      <FilterLabelsPane
        selectedLabels={draft.labels}
        onChange={(labels) => setDraft((current) => ({ ...current, labels }))}
      />
    );
  }

  return (
    <FilterDialogShell
      open={open}
      onOpenChange={setOpen}
      hasActiveFilters={hasActiveFilters}
      fields={fields.map((field) => ({ id: field.id, label: field.label }))}
      activeFieldId={activeField.id}
      onActiveFieldIdChange={(id) =>
        setActiveFieldId(id as WorkItemsFilterFieldId)
      }
      onClearAll={handleClearAllDraft}
      showAddFieldPlaceholder
      onClearActiveField={clearActiveField}
      onOkay={handleOkay}
      footerCountLabel={footerCountLabel}
    >
      {fieldPane}
    </FilterDialogShell>
  );
}
