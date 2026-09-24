'use client';

import { useEffect, useMemo, useState } from 'react';
import { WORK_ITEM_TYPES } from '@repo/types';
import { ALL_OPTION } from '@/app/_shared/values';
import {
  applyProjectFilterToSearchParams,
  buildSprintFilterOptionsForQuery,
} from '@/app/board/_services/board.defaults.shared';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import {
  resolvePreferenceFromFilterDraft,
  type WorkspaceDefaultsSaveIntent,
} from '@/app/board/_helpers/workspace-defaults-shared';
import type { Project } from '@/app/projects/_services/projects.mutations.client';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import type { User } from '@/app/users/_services/users.mutations.client';
import {
  FilterDialogShell,
  FilterOptionsChecklistPane,
  filterDialogOptionsBySearch,
  type FilterDialogNavField,
  type FilterDialogOption,
} from '@/components/filter-dialog-shell';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';

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
  readonly onSaveWorkspaceDefaults?: (
    // eslint-disable-next-line no-unused-vars -- callback signature
    preference: BoardDefaultsPreference | null
  ) => void;
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
  onSaveWorkspaceDefaults,
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
  const [defaultsIntent, setDefaultsIntent] =
    useState<WorkspaceDefaultsSaveIntent | null>(null);

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
    setDefaultsIntent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition only
  }, [open]);

  useEffect(() => {
    setOptionSearch('');
  }, [activeFieldId]);

  const activeField =
    CALENDAR_FILTER_FIELDS.find((field) => field.id === activeFieldId) ??
    CALENDAR_FILTER_FIELDS[0];

  const options: FilterDialogOption[] = useMemo(() => {
    switch (activeFieldId) {
      case 'project':
        return projects.map((project) => ({
          value: project.id,
          label: project.name,
        }));
      case 'sprint':
        return buildSprintFilterOptionsForQuery(
          sprints,
          draft.project,
          QUERY_FILTER_ALL_VALUE
        );
      case 'assignee':
        return users.map((user) => ({
          value: user.id,
          label: user.name,
        }));
      case 'type':
        return WORK_ITEM_TYPES.map((workItemType) => ({
          value: workItemType,
          label: workItemType,
        }));
      default:
        return [];
    }
  }, [activeFieldId, draft.project, projects, sprints, users]);

  const filteredOptions = filterDialogOptionsBySearch(options, optionSearch);

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
        if (defaultsIntent && onSaveWorkspaceDefaults) {
          onSaveWorkspaceDefaults(
            resolvePreferenceFromFilterDraft({
              intent: defaultsIntent,
              projectValue: draft.project,
              sprintValue: draft.sprint,
              allValue: QUERY_FILTER_ALL_VALUE,
              sprints,
            })
          );
        }
        onApplyFilters(draft);
        setOpen(false);
      }}
      footerCountLabel={`${filteredOptions.length + (showAllOption ? 1 : 0)} of ${filteredOptions.length + (showAllOption ? 1 : 0)}`}
      setAsDefault={
        activeFieldId === 'project' || activeFieldId === 'sprint'
          ? {
              visible: true,
              checked: defaultsIntent === activeFieldId,
              onCheckedChange: (checked) => {
                if (!checked) {
                  setDefaultsIntent(null);
                  return;
                }
                setDefaultsIntent(
                  activeFieldId === 'sprint' ? 'sprint' : 'project'
                );
              },
            }
          : undefined
      }
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
