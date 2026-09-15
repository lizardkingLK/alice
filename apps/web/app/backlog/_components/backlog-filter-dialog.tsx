'use client';

import { useEffect, useMemo, useState } from 'react';
import { BACKLOG_PRIORITY_OPTIONS } from '@/app/work-items/_helpers/work-item-priority-ui';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import type { User as DbUser } from '@/app/users/_services/users.mutations.client';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import type { BacklogActiveTab } from '@/app/backlog/_helpers/backlog-item-utils';
import { buildSprintFilterOptionsForQuery } from '@/app/board/_services/board.defaults.shared';
import {
  FilterDialogShell,
  FilterOptionsChecklistPane,
  type FilterDialogNavField,
} from '@/components/filter-dialog-shell';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';

export type BacklogFilterDraft = {
  readonly project: string;
  readonly sprint: string;
  readonly assignee: string;
  readonly priority: string;
};

type BacklogFilterDialogProps = {
  readonly projects: readonly DbProject[];
  readonly sprints: readonly Sprint[];
  readonly projectMembers: readonly DbUser[];
  readonly projectFilter: string;
  readonly sprintFilter: string;
  readonly assigneeFilter: string;
  readonly priorityFilter: string;
  readonly activeTab?: BacklogActiveTab;
  readonly hasActiveFilters: boolean;
  // eslint-disable-next-line no-unused-vars -- apply staged filters
  readonly onApplyFilters: (draft: BacklogFilterDraft) => void;
};

const BACKLOG_FILTER_FIELDS = [
  { id: 'project', label: 'Project', searchPlaceholder: 'Search projects' },
  { id: 'sprint', label: 'Sprint', searchPlaceholder: 'Search sprints' },
  { id: 'assignee', label: 'Assignee', searchPlaceholder: 'Search assignees' },
  { id: 'priority', label: 'Priority', searchPlaceholder: 'Search priorities' },
] as const satisfies ReadonlyArray<
  FilterDialogNavField & { readonly searchPlaceholder: string }
>;

type BacklogFilterFieldId = (typeof BACKLOG_FILTER_FIELDS)[number]['id'];

const ALL_LABELS: Record<BacklogFilterFieldId, string> = {
  project: 'All projects',
  sprint: 'All sprints',
  assignee: 'All assignees',
  priority: 'All priorities',
};

export function BacklogFilterDialog({
  projects,
  sprints,
  projectMembers,
  projectFilter,
  sprintFilter,
  assigneeFilter,
  priorityFilter,
  activeTab,
  hasActiveFilters,
  onApplyFilters,
}: Readonly<BacklogFilterDialogProps>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BacklogFilterDraft>({
    project: projectFilter,
    sprint: sprintFilter || QUERY_FILTER_ALL_VALUE,
    assignee: assigneeFilter,
    priority: priorityFilter,
  });
  const [activeFieldId, setActiveFieldId] =
    useState<BacklogFilterFieldId>('project');
  const [optionSearch, setOptionSearch] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft({
      project: projectFilter,
      sprint: sprintFilter || QUERY_FILTER_ALL_VALUE,
      assignee: assigneeFilter,
      priority: priorityFilter,
    });
    setOptionSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition only
  }, [open]);

  useEffect(() => {
    setOptionSearch('');
  }, [activeFieldId]);

  const activeField =
    BACKLOG_FILTER_FIELDS.find((field) => field.id === activeFieldId) ??
    BACKLOG_FILTER_FIELDS[0];

  const candidateSprints = useMemo(() => {
    if (!activeTab) {
      return sprints;
    }
    return activeTab === 'completed'
      ? sprints.filter((sprint) => sprint.status === 'closed')
      : sprints.filter(
          (sprint) => sprint.status === 'active' || sprint.status === 'planned'
        );
  }, [activeTab, sprints]);

  const options = useMemo(() => {
    switch (activeFieldId) {
      case 'project':
        return projects.map((project) => ({
          value: project.id,
          label: project.name,
        }));
      case 'sprint':
        return buildSprintFilterOptionsForQuery(
          candidateSprints,
          draft.project,
          QUERY_FILTER_ALL_VALUE
        );
      case 'assignee':
        return projectMembers.map((member) => ({
          value: member.id,
          label: member.name,
        }));
      case 'priority':
        return BACKLOG_PRIORITY_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        }));
      default:
        return [];
    }
  }, [activeFieldId, candidateSprints, draft.project, projectMembers, projects]);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(optionSearch.trim().toLowerCase())
  );

  const selectedValue = draft[activeFieldId];

  const applySelection = (value: string) => {
    if (activeFieldId === 'project') {
      setDraft((current) => {
        let nextSprint = current.sprint;
        if (
          nextSprint &&
          nextSprint !== QUERY_FILTER_ALL_VALUE &&
          value !== QUERY_FILTER_ALL_VALUE
        ) {
          const matchedSprint = sprints.find((s) => s.id === nextSprint);
          if (matchedSprint?.project?.id !== value) {
            nextSprint = QUERY_FILTER_ALL_VALUE;
          }
        }
        return {
          ...current,
          project: value,
          sprint: nextSprint,
        };
      });
      return;
    }

    if (activeFieldId === 'sprint') {
      setDraft((current) => {
        const selectedSprint = sprints.find((s) => s.id === value);
        const sprintProjectId = selectedSprint?.project?.id;
        if (
          value !== QUERY_FILTER_ALL_VALUE &&
          sprintProjectId &&
          current.project === QUERY_FILTER_ALL_VALUE
        ) {
          return {
            ...current,
            project: sprintProjectId,
            sprint: value,
          };
        }
        return { ...current, sprint: value };
      });
      return;
    }

    setDraft((current) => ({ ...current, [activeFieldId]: value }));
  };

  const clearActiveField = () => {
    if (activeFieldId === 'project') {
      setDraft((current) => ({
        ...current,
        project: QUERY_FILTER_ALL_VALUE,
        sprint: QUERY_FILTER_ALL_VALUE,
      }));
      return;
    }
    setDraft((current) => ({
      ...current,
      [activeFieldId]: QUERY_FILTER_ALL_VALUE,
    }));
  };

  return (
    <FilterDialogShell
      open={open}
      onOpenChange={setOpen}
      hasActiveFilters={hasActiveFilters}
      fields={BACKLOG_FILTER_FIELDS}
      activeFieldId={activeFieldId}
      onActiveFieldIdChange={(id) =>
        setActiveFieldId(id as BacklogFilterFieldId)
      }
      onClearAll={() =>
        setDraft({
          project: QUERY_FILTER_ALL_VALUE,
          sprint: QUERY_FILTER_ALL_VALUE,
          assignee: QUERY_FILTER_ALL_VALUE,
          priority: QUERY_FILTER_ALL_VALUE,
        })
      }
      onClearActiveField={clearActiveField}
      onOkay={() => {
        onApplyFilters(draft);
        setOpen(false);
      }}
      footerCountLabel={`${filteredOptions.length + 1} of ${filteredOptions.length + 1}`}
    >
      <FilterOptionsChecklistPane
        fieldId={activeField.id}
        searchPlaceholder={activeField.searchPlaceholder}
        optionSearch={optionSearch}
        onOptionSearchChange={setOptionSearch}
        filteredOptions={filteredOptions}
        showAllOption
        allOptionLabel={ALL_LABELS[activeFieldId]}
        selectedValue={selectedValue}
        allValue={QUERY_FILTER_ALL_VALUE}
        onApplySelection={applySelection}
        onClearActiveField={clearActiveField}
      />
    </FilterDialogShell>
  );
}
