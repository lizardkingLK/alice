'use client';

import { useEffect, useMemo, useState } from 'react';
import { WORK_ITEM_TYPES } from '@repo/types';
import { ALL_OPTION } from '@/app/_shared/values';
import {
  applyProjectFilterToSearchParams,
  buildSprintFilterOptionsForQuery,
} from '@/app/board/_services/board.defaults.shared';
import type { Project } from '@/app/projects/_services/projects.mutations.client';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import type { User } from '@/app/users/_services/users.mutations.client';
import {
  FilterDialogShell,
  FilterOptionsChecklistPane,
  type FilterDialogNavField,
} from '@/components/filter-dialog-shell';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';
import type { CalendarFilterOption } from '@/app/calendar/_components/calendar-filter-controls';

export type CalendarFilterDraft = {
  readonly project: string;
  readonly sprint: string;
  readonly assignee: string;
  readonly type: string;
};

type CalendarFilterDialogProps = {
  readonly projects: readonly Project[];
  readonly sprints: readonly Sprint[];
  readonly users: readonly User[];
  readonly projectValue: string;
  readonly sprintValue: string;
  readonly assigneeValue: string;
  readonly typeValue: string;
  readonly allowAllFilters: boolean;
  readonly hasActiveFilters: boolean;
  // eslint-disable-next-line no-unused-vars -- apply staged filters
  readonly onApplyFilters: (draft: CalendarFilterDraft) => void;
};

const CALENDAR_FILTER_FIELDS = [
  { id: 'project', label: 'Project', searchPlaceholder: 'Search projects' },
  { id: 'sprint', label: 'Sprint', searchPlaceholder: 'Search sprints' },
  { id: 'assignee', label: 'Assignee', searchPlaceholder: 'Search assignees' },
  { id: 'type', label: 'Type', searchPlaceholder: 'Search types' },
] as const satisfies ReadonlyArray<
  FilterDialogNavField & { readonly searchPlaceholder: string }
>;

type CalendarFilterFieldId = (typeof CALENDAR_FILTER_FIELDS)[number]['id'];

const ALL_LABELS: Record<CalendarFilterFieldId, string> = {
  project: 'All projects',
  sprint: 'All sprints',
  assignee: 'All assignees',
  type: 'All types',
};

function draftWithProjectChange(
  draft: CalendarFilterDraft,
  nextProject: string,
  sprints: readonly Sprint[]
): CalendarFilterDraft {
  const params = new URLSearchParams();
  applyProjectFilterToSearchParams(params, {
    nextProject,
    sprints,
    allValue: QUERY_FILTER_ALL_VALUE,
    pageMode: 'delete',
  });
  return {
    ...draft,
    project: nextProject,
    sprint: params.get('sprint') ?? QUERY_FILTER_ALL_VALUE,
  };
}

export function CalendarFilterDialog({
  projects,
  sprints,
  users,
  projectValue,
  sprintValue,
  assigneeValue,
  typeValue,
  allowAllFilters,
  hasActiveFilters,
  onApplyFilters,
}: Readonly<CalendarFilterDialogProps>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CalendarFilterDraft>({
    project: projectValue || QUERY_FILTER_ALL_VALUE,
    sprint: sprintValue || QUERY_FILTER_ALL_VALUE,
    assignee: assigneeValue,
    type: typeValue,
  });
  const [activeFieldId, setActiveFieldId] =
    useState<CalendarFilterFieldId>('project');
  const [optionSearch, setOptionSearch] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft({
      project: projectValue || QUERY_FILTER_ALL_VALUE,
      sprint: sprintValue || QUERY_FILTER_ALL_VALUE,
      assignee: assigneeValue,
      type: typeValue,
    });
    setOptionSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition only
  }, [open]);

  useEffect(() => {
    setOptionSearch('');
  }, [activeFieldId]);

  const activeField =
    CALENDAR_FILTER_FIELDS.find((field) => field.id === activeFieldId) ??
    CALENDAR_FILTER_FIELDS[0];

  const options: CalendarFilterOption[] = useMemo(() => {
    switch (activeFieldId) {
      case 'project':
        return projects.map((project) => ({
          id: project.id,
          label: project.name,
        }));
      case 'sprint':
        return buildSprintFilterOptionsForQuery(
          sprints,
          draft.project,
          QUERY_FILTER_ALL_VALUE
        ).map((option) => ({ id: option.value, label: option.label }));
      case 'assignee':
        return users.map((user) => ({ id: user.id, label: user.name }));
      case 'type':
        return WORK_ITEM_TYPES.map((workItemType) => ({
          id: workItemType,
          label: workItemType,
        }));
      default:
        return [];
    }
  }, [activeFieldId, draft.project, projects, sprints, users]);

  const filteredOptions = options
    .filter((option) =>
      option.label.toLowerCase().includes(optionSearch.trim().toLowerCase())
    )
    .map((option) => ({ value: option.id, label: option.label }));

  const selectedValue = draft[activeFieldId];
  const showAllOption =
    activeFieldId === 'assignee' || activeFieldId === 'type' || allowAllFilters;

  const applySelection = (value: string) => {
    if (activeFieldId === 'project') {
      setDraft((current) => draftWithProjectChange(current, value, sprints));
      return;
    }
    setDraft((current) => ({ ...current, [activeFieldId]: value }));
  };

  const clearActiveField = () => {
    if (!showAllOption) {
      return;
    }
    if (activeFieldId === 'project') {
      setDraft((current) =>
        draftWithProjectChange(current, QUERY_FILTER_ALL_VALUE, sprints)
      );
      return;
    }
    const clearValue =
      activeFieldId === 'assignee' || activeFieldId === 'type'
        ? ALL_OPTION
        : QUERY_FILTER_ALL_VALUE;
    setDraft((current) => ({ ...current, [activeFieldId]: clearValue }));
  };

  const emptyDraft = (): CalendarFilterDraft => ({
    project: allowAllFilters ? QUERY_FILTER_ALL_VALUE : draft.project,
    sprint: allowAllFilters ? QUERY_FILTER_ALL_VALUE : draft.sprint,
    assignee: ALL_OPTION,
    type: ALL_OPTION,
  });

  return (
    <FilterDialogShell
      open={open}
      onOpenChange={setOpen}
      hasActiveFilters={hasActiveFilters}
      fields={CALENDAR_FILTER_FIELDS}
      activeFieldId={activeFieldId}
      onActiveFieldIdChange={(id) =>
        setActiveFieldId(id as CalendarFilterFieldId)
      }
      onClearAll={() => setDraft(emptyDraft())}
      onClearActiveField={showAllOption ? clearActiveField : undefined}
      onOkay={() => {
        onApplyFilters(draft);
        setOpen(false);
      }}
      footerCountLabel={`${filteredOptions.length + (showAllOption ? 1 : 0)} of ${filteredOptions.length + (showAllOption ? 1 : 0)}`}
    >
      <FilterOptionsChecklistPane
        fieldId={activeField.id}
        searchPlaceholder={activeField.searchPlaceholder}
        optionSearch={optionSearch}
        onOptionSearchChange={setOptionSearch}
        filteredOptions={filteredOptions}
        showAllOption={showAllOption}
        allOptionLabel={ALL_LABELS[activeFieldId]}
        selectedValue={selectedValue}
        allValue={
          activeFieldId === 'assignee' || activeFieldId === 'type'
            ? ALL_OPTION
            : QUERY_FILTER_ALL_VALUE
        }
        onApplySelection={applySelection}
        onClearActiveField={clearActiveField}
      />
    </FilterDialogShell>
  );
}
