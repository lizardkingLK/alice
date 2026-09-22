'use client';

import { useEffect, useMemo, useState } from 'react';
import { BACKLOG_PRIORITY_OPTIONS } from '@/app/work-items/_helpers/work-item-priority-ui';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import type { User as DbUser } from '@/app/users/_services/users.mutations.client';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import {
  BacklogActiveTabEnum,
  type BacklogActiveTab,
} from '@/app/backlog/_helpers/backlog-item-utils';
import { buildSprintFilterOptionsForQuery } from '@/app/board/_services/board.defaults.shared';
import {
  FilterDialogShell,
  FilterOptionsChecklistPane,
  type FilterDialogNavField,
} from '@/components/filter-dialog-shell';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';
import { SprintStatusEnum } from '@repo/types';

/* eslint-disable no-unused-vars */
export enum BacklogFilterFieldId {
  Project = 'project',
  Sprint = 'sprint',
  Assignee = 'assignee',
  Priority = 'priority',
}

export enum BacklogFilterFieldLabel {
  Project = 'Project',
  Sprint = 'Sprint',
  Assignee = 'Assignee',
  Priority = 'Priority',
}

export enum BacklogFilterSearchPlaceholder {
  Project = 'Search projects',
  Sprint = 'Search sprints',
  Assignee = 'Search assignees',
  Priority = 'Search priorities',
}

export enum BacklogFilterAllLabel {
  Project = 'All projects',
  Sprint = 'All sprints',
  Assignee = 'All assignees',
  Priority = 'All priorities',
}
/* eslint-enable no-unused-vars */

export { BacklogFilterFieldId as BacklogFilterField };

export type BacklogFilterDraft = {
  readonly [BacklogFilterFieldId.Project]: string;
  readonly [BacklogFilterFieldId.Sprint]: string;
  readonly [BacklogFilterFieldId.Assignee]: string;
  readonly [BacklogFilterFieldId.Priority]: string;
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
  {
    id: BacklogFilterFieldId.Project,
    label: BacklogFilterFieldLabel.Project,
    searchPlaceholder: BacklogFilterSearchPlaceholder.Project,
  },
  {
    id: BacklogFilterFieldId.Sprint,
    label: BacklogFilterFieldLabel.Sprint,
    searchPlaceholder: BacklogFilterSearchPlaceholder.Sprint,
  },
  {
    id: BacklogFilterFieldId.Assignee,
    label: BacklogFilterFieldLabel.Assignee,
    searchPlaceholder: BacklogFilterSearchPlaceholder.Assignee,
  },
  {
    id: BacklogFilterFieldId.Priority,
    label: BacklogFilterFieldLabel.Priority,
    searchPlaceholder: BacklogFilterSearchPlaceholder.Priority,
  },
] as const satisfies ReadonlyArray<
  FilterDialogNavField & { readonly searchPlaceholder: string }
>;

const ALL_LABELS: Record<BacklogFilterFieldId, string> = {
  [BacklogFilterFieldId.Project]: BacklogFilterAllLabel.Project,
  [BacklogFilterFieldId.Sprint]: BacklogFilterAllLabel.Sprint,
  [BacklogFilterFieldId.Assignee]: BacklogFilterAllLabel.Assignee,
  [BacklogFilterFieldId.Priority]: BacklogFilterAllLabel.Priority,
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
    [BacklogFilterFieldId.Project]: projectFilter,
    [BacklogFilterFieldId.Sprint]: sprintFilter || QUERY_FILTER_ALL_VALUE,
    [BacklogFilterFieldId.Assignee]: assigneeFilter,
    [BacklogFilterFieldId.Priority]: priorityFilter,
  });
  const [activeFieldId, setActiveFieldId] = useState<BacklogFilterFieldId>(
    BacklogFilterFieldId.Project
  );
  const [optionSearch, setOptionSearch] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft({
      [BacklogFilterFieldId.Project]: projectFilter,
      [BacklogFilterFieldId.Sprint]: sprintFilter || QUERY_FILTER_ALL_VALUE,
      [BacklogFilterFieldId.Assignee]: assigneeFilter,
      [BacklogFilterFieldId.Priority]: priorityFilter,
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
    return activeTab === BacklogActiveTabEnum.Completed
      ? sprints.filter((sprint) => sprint.status === SprintStatusEnum.Closed)
      : sprints.filter(
          (sprint) =>
            sprint.status === SprintStatusEnum.Active ||
            sprint.status === SprintStatusEnum.Planned
        );
  }, [activeTab, sprints]);

  const options = useMemo(() => {
    switch (activeFieldId) {
      case BacklogFilterFieldId.Project:
        return projects.map((project) => ({
          value: project.id,
          label: project.name,
        }));
      case BacklogFilterFieldId.Sprint:
        return buildSprintFilterOptionsForQuery(
          candidateSprints,
          draft[BacklogFilterFieldId.Project],
          QUERY_FILTER_ALL_VALUE
        );
      case BacklogFilterFieldId.Assignee:
        return projectMembers.map((member) => ({
          value: member.id,
          label: member.name,
        }));
      case BacklogFilterFieldId.Priority:
        return BACKLOG_PRIORITY_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        }));
      default:
        return [];
    }
  }, [activeFieldId, candidateSprints, draft, projectMembers, projects]);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(optionSearch.trim().toLowerCase())
  );

  const selectedValue = draft[activeFieldId];

  const applySelection = (value: string) => {
    if (activeFieldId === BacklogFilterFieldId.Project) {
      setDraft((current) => {
        let nextSprint = current[BacklogFilterFieldId.Sprint];
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
          [BacklogFilterFieldId.Project]: value,
          [BacklogFilterFieldId.Sprint]: nextSprint,
        };
      });
      return;
    }

    if (activeFieldId === BacklogFilterFieldId.Sprint) {
      setDraft((current) => {
        const selectedSprint = sprints.find((s) => s.id === value);
        const sprintProjectId = selectedSprint?.project?.id;
        if (
          value !== QUERY_FILTER_ALL_VALUE &&
          sprintProjectId &&
          current[BacklogFilterFieldId.Project] === QUERY_FILTER_ALL_VALUE
        ) {
          return {
            ...current,
            [BacklogFilterFieldId.Project]: sprintProjectId,
            [BacklogFilterFieldId.Sprint]: value,
          };
        }
        return { ...current, [BacklogFilterFieldId.Sprint]: value };
      });
      return;
    }

    setDraft((current) => ({ ...current, [activeFieldId]: value }));
  };

  const clearActiveField = () => {
    if (activeFieldId === BacklogFilterFieldId.Project) {
      setDraft((current) => ({
        ...current,
        [BacklogFilterFieldId.Project]: QUERY_FILTER_ALL_VALUE,
        [BacklogFilterFieldId.Sprint]: QUERY_FILTER_ALL_VALUE,
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
          [BacklogFilterFieldId.Project]: QUERY_FILTER_ALL_VALUE,
          [BacklogFilterFieldId.Sprint]: QUERY_FILTER_ALL_VALUE,
          [BacklogFilterFieldId.Assignee]: QUERY_FILTER_ALL_VALUE,
          [BacklogFilterFieldId.Priority]: QUERY_FILTER_ALL_VALUE,
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
