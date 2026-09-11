'use client';

import { useEffect, useMemo, useState } from 'react';
import { BACKLOG_PRIORITY_OPTIONS } from '@/app/work-items/_helpers/work-item-priority-ui';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import type { User as DbUser } from '@/app/users/_services/users.mutations.client';
import {
  FilterDialogShell,
  FilterOptionsChecklistPane,
  type FilterDialogNavField,
} from '@/components/filter-dialog-shell';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';

export type BacklogFilterDraft = {
  readonly project: string;
  readonly assignee: string;
  readonly priority: string;
};

type BacklogFilterDialogProps = {
  readonly projects: readonly DbProject[];
  readonly projectMembers: readonly DbUser[];
  readonly projectFilter: string;
  readonly assigneeFilter: string;
  readonly priorityFilter: string;
  readonly hasActiveFilters: boolean;
  // eslint-disable-next-line no-unused-vars -- apply staged filters
  readonly onApplyFilters: (draft: BacklogFilterDraft) => void;
};

const BACKLOG_FILTER_FIELDS = [
  { id: 'project', label: 'Project', searchPlaceholder: 'Search projects' },
  { id: 'assignee', label: 'Assignee', searchPlaceholder: 'Search assignees' },
  { id: 'priority', label: 'Priority', searchPlaceholder: 'Search priorities' },
] as const satisfies ReadonlyArray<
  FilterDialogNavField & { readonly searchPlaceholder: string }
>;

type BacklogFilterFieldId = (typeof BACKLOG_FILTER_FIELDS)[number]['id'];

const ALL_LABELS: Record<BacklogFilterFieldId, string> = {
  project: 'All projects',
  assignee: 'All assignees',
  priority: 'All priorities',
};

export function BacklogFilterDialog({
  projects,
  projectMembers,
  projectFilter,
  assigneeFilter,
  priorityFilter,
  hasActiveFilters,
  onApplyFilters,
}: Readonly<BacklogFilterDialogProps>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BacklogFilterDraft>({
    project: projectFilter,
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

  const options = useMemo(() => {
    switch (activeFieldId) {
      case 'project':
        return projects.map((project) => ({
          value: project.id,
          label: project.name,
        }));
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
  }, [activeFieldId, projectMembers, projects]);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(optionSearch.trim().toLowerCase())
  );

  const selectedValue = draft[activeFieldId];

  const applySelection = (value: string) => {
    setDraft((current) => ({ ...current, [activeFieldId]: value }));
  };

  const clearActiveField = () => {
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
