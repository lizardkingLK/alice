'use client';

import { useEffect, useState } from 'react';
import type {
  ChartBoardOwnershipFilter,
  ChartBoardStatusFilter,
} from '@/app/charts/_components/charts.types';
import {
  FilterDialogShell,
  FilterOptionsChecklistPane,
  type FilterDialogNavField,
} from '@/components/filter-dialog-shell';

export type ChartsFilterDraft = {
  readonly ownership: ChartBoardOwnershipFilter;
  readonly status: ChartBoardStatusFilter;
};

type ChartsFilterDialogProps = {
  readonly ownership: ChartBoardOwnershipFilter;
  readonly status: ChartBoardStatusFilter;
  readonly hasActiveFilters: boolean;
  // eslint-disable-next-line no-unused-vars -- apply staged filters
  readonly onApplyFilters: (draft: ChartsFilterDraft) => void;
};

const CHART_FILTER_FIELDS = [
  {
    id: 'ownership',
    label: 'Ownership',
    searchPlaceholder: 'Search ownership',
  },
  { id: 'status', label: 'Status', searchPlaceholder: 'Search status' },
] as const satisfies ReadonlyArray<
  FilterDialogNavField & { readonly searchPlaceholder: string }
>;

type ChartsFilterFieldId = (typeof CHART_FILTER_FIELDS)[number]['id'];

const OWNERSHIP_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'shared', label: 'Shared with me' },
] as const;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
] as const;

export function ChartsFilterDialog({
  ownership,
  status,
  hasActiveFilters,
  onApplyFilters,
}: Readonly<ChartsFilterDialogProps>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ChartsFilterDraft>({
    ownership,
    status,
  });
  const [activeFieldId, setActiveFieldId] =
    useState<ChartsFilterFieldId>('ownership');
  const [optionSearch, setOptionSearch] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft({ ownership, status });
    setOptionSearch('');
    // Seed once when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition only
  }, [open]);

  useEffect(() => {
    setOptionSearch('');
  }, [activeFieldId]);

  const activeField =
    CHART_FILTER_FIELDS.find((field) => field.id === activeFieldId) ??
    CHART_FILTER_FIELDS[0];

  const options =
    activeFieldId === 'ownership' ? OWNERSHIP_OPTIONS : STATUS_OPTIONS;
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(optionSearch.trim().toLowerCase())
  );
  const selectedValue =
    activeFieldId === 'ownership' ? draft.ownership : draft.status;

  const applySelection = (value: string) => {
    if (activeFieldId === 'ownership') {
      setDraft((prev) => ({
        ...prev,
        ownership: value as ChartBoardOwnershipFilter,
      }));
      return;
    }
    setDraft((prev) => ({
      ...prev,
      status: value as ChartBoardStatusFilter,
    }));
  };

  const clearActiveField = () => {
    if (activeFieldId === 'ownership') {
      setDraft((prev) => ({ ...prev, ownership: 'all' }));
      return;
    }
    setDraft((prev) => ({ ...prev, status: 'all' }));
  };

  return (
    <FilterDialogShell
      open={open}
      onOpenChange={setOpen}
      hasActiveFilters={hasActiveFilters}
      fields={CHART_FILTER_FIELDS}
      activeFieldId={activeFieldId}
      onActiveFieldIdChange={(id) =>
        setActiveFieldId(id as ChartsFilterFieldId)
      }
      onClearAll={() => setDraft({ ownership: 'all', status: 'all' })}
      onClearActiveField={clearActiveField}
      onOkay={() => {
        onApplyFilters(draft);
        setOpen(false);
      }}
      footerCountLabel={`${filteredOptions.length} of ${filteredOptions.length}`}
    >
      <FilterOptionsChecklistPane
        fieldId={activeField.id}
        searchPlaceholder={activeField.searchPlaceholder}
        optionSearch={optionSearch}
        onOptionSearchChange={setOptionSearch}
        filteredOptions={[...filteredOptions]}
        showAllOption={false}
        allOptionLabel="All"
        selectedValue={selectedValue}
        allValue="all"
        onApplySelection={applySelection}
        onClearActiveField={clearActiveField}
      />
    </FilterDialogShell>
  );
}
