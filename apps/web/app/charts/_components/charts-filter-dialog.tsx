'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { Search } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type {
  ChartBoardOwnershipFilter,
  ChartBoardStatusFilter,
  ChartWorkspaceRecord,
} from '@/app/charts/_components/charts.types';
import { ChartsSaveWorkspaceDialog } from '@/app/charts/_components/charts-save-workspace-dialog';
import {
  FILTER_OPTIONS_SCROLL_CLASS,
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
  readonly workspaces: readonly ChartWorkspaceRecord[];
  readonly currentWorkspaceId: string;
  readonly saveDefaultTitle: string;
  readonly currentIsOverview: boolean;
  // eslint-disable-next-line no-unused-vars -- apply staged filters
  readonly onApplyFilters: (draft: ChartsFilterDraft) => void;
  // eslint-disable-next-line no-unused-vars -- open workspace
  readonly onSelectWorkspace: (workspaceId: string) => void;
  readonly onSaveWorkspace: (
    // eslint-disable-next-line no-unused-vars
    payload: { title: string; isOverview: boolean }
  ) => void;
};

const CHART_FILTER_FIELDS = [
  {
    id: 'workspaces',
    label: 'Workspaces',
    searchPlaceholder: 'Search workspaces',
  },
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
  workspaces,
  currentWorkspaceId,
  saveDefaultTitle,
  currentIsOverview,
  onApplyFilters,
  onSelectWorkspace,
  onSaveWorkspace,
}: Readonly<ChartsFilterDialogProps>) {
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [draft, setDraft] = useState<ChartsFilterDraft>({
    ownership,
    status,
  });
  const [activeFieldId, setActiveFieldId] =
    useState<ChartsFilterFieldId>('workspaces');
  const [optionSearch, setOptionSearch] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft({ ownership, status });
    setOptionSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition only
  }, [open]);

  useEffect(() => {
    setOptionSearch('');
  }, [activeFieldId]);

  const activeField =
    CHART_FILTER_FIELDS.find((field) => field.id === activeFieldId) ??
    CHART_FILTER_FIELDS[0];

  const filteredWorkspaces = useMemo(() => {
    const query = optionSearch.trim().toLowerCase();
    return workspaces.filter((workspace) => {
      if (draft.ownership === 'shared') {
        return false;
      }
      if (draft.status !== 'all' && workspace.status !== draft.status) {
        return false;
      }
      if (query && !workspace.title.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [draft.ownership, draft.status, optionSearch, workspaces]);

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
    if (activeFieldId === 'status') {
      setDraft((prev) => ({ ...prev, status: 'all' }));
    }
  };

  return (
    <>
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
        onClearActiveField={
          activeFieldId === 'workspaces' ? undefined : clearActiveField
        }
        onOkay={() => {
          onApplyFilters(draft);
          setOpen(false);
        }}
        footerCountLabel={
          activeFieldId === 'workspaces'
            ? `${filteredWorkspaces.length} workspaces`
            : `${filteredOptions.length} of ${filteredOptions.length}`
        }
        footerStart={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 cursor-pointer px-2 text-xs"
            onClick={() => setSaveOpen(true)}
          >
            Save workspace
          </Button>
        }
      >
        {activeFieldId === 'workspaces' ? (
          <>
            <div className="border-border border-b py-3 pr-12 pl-3">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={optionSearch}
                  onChange={(event) => setOptionSearch(event.target.value)}
                  placeholder={activeField.searchPlaceholder}
                  aria-label={activeField.searchPlaceholder}
                  className="pl-9"
                />
              </div>
            </div>
            <div
              className={cn(
                'min-h-0 overflow-y-auto p-3',
                FILTER_OPTIONS_SCROLL_CLASS
              )}
            >
              {filteredWorkspaces.length === 0 ? (
                <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                  No workspaces match these filters.
                </p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {filteredWorkspaces.map((workspace) => {
                    const selected = workspace.id === currentWorkspaceId;
                    return (
                      <li key={workspace.id}>
                        <button
                          type="button"
                          className={cn(
                            'hover:bg-muted/50 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                            selected && 'bg-primary/10 text-primary'
                          )}
                          onClick={() => {
                            onSelectWorkspace(workspace.id);
                            setOpen(false);
                          }}
                        >
                          <TruncatedText className="min-w-0 flex-1 font-medium">
                            {workspace.title}
                          </TruncatedText>
                          {workspace.isOverview ? (
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-[10px]"
                            >
                              Overview
                            </Badge>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : (
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
        )}
      </FilterDialogShell>

      <ChartsSaveWorkspaceDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        defaultTitle={saveDefaultTitle}
        initialIsOverview={currentIsOverview}
        onSave={onSaveWorkspace}
      />
    </>
  );
}
