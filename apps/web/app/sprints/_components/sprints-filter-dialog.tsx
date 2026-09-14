'use client';

import { useEffect, useState } from 'react';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import {
  FilterDialogShell,
  FilterOptionsChecklistPane,
} from '@/components/filter-dialog-shell';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';

type SprintsFilterDialogProps = {
  readonly projects: readonly Project[];
  readonly projectValue: string;
  readonly hasActiveFilters: boolean;
  // eslint-disable-next-line no-unused-vars -- apply project filter
  readonly onApplyProject: (projectId: string) => void;
};

const PROJECT_FIELD = {
  id: 'project',
  label: 'Project',
  searchPlaceholder: 'Search projects',
} as const;

export function SprintsFilterDialog({
  projects,
  projectValue,
  hasActiveFilters,
  onApplyProject,
}: Readonly<SprintsFilterDialogProps>) {
  const [open, setOpen] = useState(false);
  const [draftProject, setDraftProject] = useState(projectValue);
  const [optionSearch, setOptionSearch] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftProject(projectValue);
    setOptionSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition only
  }, [open]);

  const options = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(optionSearch.trim().toLowerCase())
  );

  return (
    <FilterDialogShell
      open={open}
      onOpenChange={setOpen}
      hasActiveFilters={hasActiveFilters}
      fields={[PROJECT_FIELD]}
      activeFieldId={PROJECT_FIELD.id}
      onClearAll={() => setDraftProject(QUERY_FILTER_ALL_VALUE)}
      onClearActiveField={() => setDraftProject(QUERY_FILTER_ALL_VALUE)}
      onOkay={() => {
        onApplyProject(draftProject);
        setOpen(false);
      }}
      footerCountLabel={`${filteredOptions.length + 1} of ${filteredOptions.length + 1}`}
    >
      <FilterOptionsChecklistPane
        fieldId={PROJECT_FIELD.id}
        searchPlaceholder={PROJECT_FIELD.searchPlaceholder}
        optionSearch={optionSearch}
        onOptionSearchChange={setOptionSearch}
        filteredOptions={filteredOptions}
        showAllOption
        allOptionLabel="All projects"
        selectedValue={draftProject}
        allValue={QUERY_FILTER_ALL_VALUE}
        onApplySelection={setDraftProject}
        onClearActiveField={() => setDraftProject(QUERY_FILTER_ALL_VALUE)}
      />
    </FilterDialogShell>
  );
}
