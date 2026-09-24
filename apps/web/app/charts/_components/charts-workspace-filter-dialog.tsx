'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import {
  resolvePreferenceFromFilterDraft,
  type WorkspaceDefaultsSaveIntent,
} from '@/app/board/_helpers/workspace-defaults-shared';
import { buildSprintFilterOptionsForQuery } from '@/app/board/_services/board.defaults.shared';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import {
  FilterDialogShell,
  FilterOptionsChecklistPane,
  filterDialogOptionsBySearch,
  type FilterDialogNavField,
  type FilterDialogOption,
} from '@/components/filter-dialog-shell';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';

type ChartsFilterDraft = {
  readonly project: string;
  readonly sprint: string;
};

type ChartsWorkspaceFilterDialogProps = {
  readonly projects: readonly Project[];
  readonly sprints: readonly Sprint[];
  readonly savedPreference: BoardDefaultsPreference | null;
  readonly onSaveWorkspaceDefaults: (
    // eslint-disable-next-line no-unused-vars -- callback signature
    preference: BoardDefaultsPreference | null
  ) => void;
};

const CHARTS_FILTER_FIELDS = [
  { id: 'project', label: 'Project', searchPlaceholder: 'Search projects' },
  { id: 'sprint', label: 'Sprint', searchPlaceholder: 'Search sprints' },
] as const satisfies ReadonlyArray<
  FilterDialogNavField & { readonly searchPlaceholder: string }
>;

type ChartsFilterFieldId = (typeof CHARTS_FILTER_FIELDS)[number]['id'];

function draftFromPreference(
  preference: BoardDefaultsPreference | null
): ChartsFilterDraft {
  if (!preference) {
    return {
      project: QUERY_FILTER_ALL_VALUE,
      sprint: QUERY_FILTER_ALL_VALUE,
    };
  }
  return {
    project: preference.projectId,
    sprint: preference.sprintId ?? QUERY_FILTER_ALL_VALUE,
  };
}

/**
 * Charts Filter dialog (project / sprint) used to set workspace defaults that
 * seed new Chart widgets. No page URL rewrite.
 */
export function ChartsWorkspaceFilterDialog({
  projects,
  sprints,
  savedPreference,
  onSaveWorkspaceDefaults,
}: Readonly<ChartsWorkspaceFilterDialogProps>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ChartsFilterDraft>(() =>
    draftFromPreference(savedPreference)
  );
  const [activeFieldId, setActiveFieldId] =
    useState<ChartsFilterFieldId>('project');
  const [optionSearch, setOptionSearch] = useState('');
  const [defaultsIntent, setDefaultsIntent] =
    useState<WorkspaceDefaultsSaveIntent | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft(draftFromPreference(savedPreference));
    setOptionSearch('');
    setDefaultsIntent(null);
  }, [open, savedPreference]);

  useEffect(() => {
    setOptionSearch('');
  }, [activeFieldId]);

  const activeField =
    CHARTS_FILTER_FIELDS.find((field) => field.id === activeFieldId) ??
    CHARTS_FILTER_FIELDS[0];

  const options: FilterDialogOption[] = useMemo(() => {
    if (activeFieldId === 'project') {
      return projects.map((project) => ({
        value: project.id,
        label: project.name,
      }));
    }
    return buildSprintFilterOptionsForQuery(
      sprints,
      draft.project,
      QUERY_FILTER_ALL_VALUE
    );
  }, [activeFieldId, draft.project, projects, sprints]);

  const filteredOptions = filterDialogOptionsBySearch(options, optionSearch);
  const selectedValue = draft[activeFieldId];

  const applySelection = (value: string) => {
    if (activeFieldId === 'project') {
      setDraft({
        project: value,
        sprint: QUERY_FILTER_ALL_VALUE,
      });
      return;
    }
    setDraft((current) => ({ ...current, sprint: value }));
  };

  const clearActiveField = () => {
    if (activeFieldId === 'project') {
      setDraft({
        project: QUERY_FILTER_ALL_VALUE,
        sprint: QUERY_FILTER_ALL_VALUE,
      });
      return;
    }
    setDraft((current) => ({
      ...current,
      sprint: QUERY_FILTER_ALL_VALUE,
    }));
  };

  return (
    <FilterDialogShell
      open={open}
      onOpenChange={setOpen}
      hasActiveFilters={savedPreference !== null}
      fields={CHARTS_FILTER_FIELDS}
      activeFieldId={activeFieldId}
      onActiveFieldIdChange={(id) =>
        setActiveFieldId(id as ChartsFilterFieldId)
      }
      onClearAll={() =>
        setDraft({
          project: QUERY_FILTER_ALL_VALUE,
          sprint: QUERY_FILTER_ALL_VALUE,
        })
      }
      onClearActiveField={clearActiveField}
      onOkay={() => {
        const intent =
          defaultsIntent ??
          (draft.sprint && draft.sprint !== QUERY_FILTER_ALL_VALUE
            ? 'sprint'
            : 'project');
        onSaveWorkspaceDefaults(
          resolvePreferenceFromFilterDraft({
            intent,
            projectValue: draft.project,
            sprintValue: draft.sprint,
            allValue: QUERY_FILTER_ALL_VALUE,
            sprints,
          })
        );
        setOpen(false);
      }}
      footerCountLabel={`${filteredOptions.length + 1} of ${filteredOptions.length + 1}`}
      setAsDefault={{
        visible: true,
        checked: defaultsIntent === activeFieldId,
        onCheckedChange: (checked) => {
          if (!checked) {
            setDefaultsIntent(null);
            return;
          }
          setDefaultsIntent(activeFieldId === 'sprint' ? 'sprint' : 'project');
        },
      }}
    >
      <FilterOptionsChecklistPane
        fieldId={activeField.id}
        searchPlaceholder={activeField.searchPlaceholder}
        optionSearch={optionSearch}
        onOptionSearchChange={setOptionSearch}
        filteredOptions={filteredOptions}
        showAllOption
        allOptionLabel={
          activeFieldId === 'project' ? 'All projects' : 'All sprints'
        }
        selectedValue={selectedValue}
        allValue={QUERY_FILTER_ALL_VALUE}
        onApplySelection={applySelection}
        onClearActiveField={clearActiveField}
      />
    </FilterDialogShell>
  );
}
