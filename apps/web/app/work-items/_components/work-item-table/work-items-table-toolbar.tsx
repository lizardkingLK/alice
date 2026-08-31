'use client';

import { Button } from '@repo/ui/components/ui/button';
import { List, ListTree, Plus, X } from '@repo/ui/lib/icons';
import type { VisibilityState } from '@tanstack/react-table';
import { WorkspaceDefaultsControls } from '@/app/board/_components/workspace-defaults-controls';
import type { WorkItemsFilterDraft } from '@/app/work-items/_components/work-item-table/work-item-table-helpers';
import type { FilterQuery } from '@/app/work-items/_components/work-item-table/work-items-table-types';
import { WorkItemsColumnsDialog } from '@/app/work-items/_components/work-item-registry/work-items-columns-dialog';
import { WorkItemsFilterDialog } from '@/app/work-items/_components/work-item-registry/work-items-filter-dialog';
import type { WorkItemWorkspaceProps } from '@/app/work-items/_components/work-items-workspace';
import { RegistryTabSwitcher } from '@/components/registry-tab-switcher';
import { SearchInput } from '@/components/search-input';
import type { WorkItemListView } from '@/lib/search-params';

const WORK_ITEM_TABS = [
  { id: 'active' as const, label: 'Active' },
  { id: 'archived' as const, label: 'Archived' },
] as const;

const WORK_ITEM_LIST_VIEW_OPTIONS = [
  { view: 'flat' as const, label: 'Flat', Icon: List },
  { view: 'hierarchy' as const, label: 'Hierarchy', Icon: ListTree },
] as const;

function WorkItemListViewToggle({
  listView,
  onListViewChange,
}: Readonly<{
  listView: WorkItemListView;
  // eslint-disable-next-line no-unused-vars -- view change callback
  onListViewChange: (view: WorkItemListView) => void;
}>) {
  return (
    <fieldset
      className="border-border m-0 flex h-9 min-w-0 items-center rounded-lg border p-0.5"
      aria-label="Work items view mode"
    >
      {WORK_ITEM_LIST_VIEW_OPTIONS.map(({ view, label, Icon }) => {
        const isActive = listView === view;
        return (
          <Button
            key={view}
            type="button"
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 cursor-pointer gap-1.5 px-2.5 text-xs"
            aria-pressed={isActive}
            onClick={() => onListViewChange(view)}
          >
            <Icon className="size-3.5" />
            {label}
          </Button>
        );
      })}
    </fieldset>
  );
}

export function WorkItemsTableToolbar({
  searchQuery,
  onSearchChange,
  onClearSearch,
  isProjectLocked,
  isAssigneeLocked,
  isHierarchy,
  tab,
  onTabChange,
  projects,
  projectMembers,
  sprints,
  projectQuery,
  sprintQuery,
  typeQuery,
  assigneeQuery,
  labelsQuery,
  onApplyFilters,
  onListViewChange,
  columnVisibility,
  onApplyColumnVisibility,
  columnsHydrated,
  showWorkspaceDefaults,
  onOpenDefaultsDialog,
  savedDefaultsApplied,
  hasActiveFilters,
  onClearFilters,
  onCreate,
  hideCreate = false,
}: Readonly<{
  searchQuery: string;
  // eslint-disable-next-line no-unused-vars -- search change callback
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  isProjectLocked: boolean;
  isAssigneeLocked: boolean;
  isHierarchy: boolean;
  tab: 'active' | 'archived';
  // eslint-disable-next-line no-unused-vars -- tab change callback
  onTabChange: (tab: 'active' | 'archived') => void;
  projects: WorkItemWorkspaceProps['projects'];
  projectMembers: WorkItemWorkspaceProps['projectMembers'];
  sprints: WorkItemWorkspaceProps['sprints'];
  projectQuery: FilterQuery;
  sprintQuery: FilterQuery;
  typeQuery: FilterQuery;
  assigneeQuery: FilterQuery;
  labelsQuery: FilterQuery;
  // eslint-disable-next-line no-unused-vars -- apply staged filters
  onApplyFilters: (draft: WorkItemsFilterDraft) => void;
  // eslint-disable-next-line no-unused-vars -- view change callback
  onListViewChange: (view: WorkItemListView) => void;
  columnVisibility: VisibilityState;
  // eslint-disable-next-line no-unused-vars -- apply staged columns
  onApplyColumnVisibility: (visibility: VisibilityState) => void;
  columnsHydrated: boolean;
  showWorkspaceDefaults: boolean;
  onOpenDefaultsDialog: () => void;
  savedDefaultsApplied: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
  hideCreate?: boolean;
}>) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={searchQuery}
          onValueChange={onSearchChange}
          onClear={onClearSearch}
          placeholder="Search work items..."
        />

        <WorkItemsFilterDialog
          projects={projects}
          projectMembers={projectMembers}
          sprints={sprints}
          projectQuery={projectQuery}
          sprintQuery={sprintQuery}
          typeQuery={typeQuery}
          assigneeQuery={assigneeQuery}
          labelsQuery={labelsQuery}
          isProjectLocked={isProjectLocked}
          isAssigneeLocked={isAssigneeLocked}
          onApplyFilters={onApplyFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <WorkItemListViewToggle
          listView={isHierarchy ? 'hierarchy' : 'flat'}
          onListViewChange={onListViewChange}
        />

        <WorkItemsColumnsDialog
          visibility={columnVisibility}
          isProjectLocked={isProjectLocked}
          disabled={!columnsHydrated}
          onApply={onApplyColumnVisibility}
        />

        {showWorkspaceDefaults ? (
          <WorkspaceDefaultsControls
            onOpenDefaultsDialog={onOpenDefaultsDialog}
            savedDefaultsApplied={savedDefaultsApplied}
          />
        ) : null}

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground h-9 cursor-pointer px-3 text-xs"
          >
            Clear filters
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 self-start">
        <RegistryTabSwitcher
          tabs={WORK_ITEM_TABS}
          value={tab}
          onChange={onTabChange}
        />

        {hideCreate ? null : (
          <Button onClick={onCreate} className="shrink-0">
            <Plus />
            Add Work-Item
          </Button>
        )}
      </div>
    </div>
  );
}
