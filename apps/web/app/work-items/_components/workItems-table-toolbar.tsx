'use client';

import { Button } from '@repo/ui/components/ui/button';
import { List, ListTree, Loader2, Plus, X } from '@repo/ui/lib/icons';
import { WorkspaceDefaultsControls } from '@/app/board/_components/workspace-defaults-controls';
import type { WorkItemWorkspaceProps } from '@/app/work-items/_components/workItems-workspace';
import type { FilterQuery } from '@/app/work-items/_components/workItems-table-types';
import { SearchInput } from '@/components/search-input';
import { ListFilterSelect } from '@/components/list-filter-select';
import { Constants } from '@repo/types/database';
import type { WorkItemListView } from '@/lib/search-params';

const WORK_ITEM_TYPES = Constants.public.Enums.WorkItemType;

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
    <div
      className="border-border flex h-9 items-center rounded-lg border p-0.5"
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
    </div>
  );
}

export function WorkItemsTableToolbar({
  searchQuery,
  onSearchChange,
  isProjectLocked,
  isAssigneeLocked,
  isHierarchy,
  projects,
  projectMembers,
  projectQuery,
  sprintQuery,
  typeQuery,
  assigneeQuery,
  sprintOptions,
  onProjectChange,
  onListViewChange,
  rootCount,
  isExpandingAll,
  expandedCount,
  onExpandAll,
  onCollapseAll,
  showWorkspaceDefaults,
  onOpenDefaultsDialog,
  savedDefaultsApplied,
  hasActiveFilters,
  onClearFilters,
  onCreate,
}: Readonly<{
  searchQuery: string;
  // eslint-disable-next-line no-unused-vars
  onSearchChange: (value: string) => void;
  isProjectLocked: boolean;
  isAssigneeLocked: boolean;
  isHierarchy: boolean;
  projects: WorkItemWorkspaceProps['projects'];
  projectMembers: WorkItemWorkspaceProps['projectMembers'];
  projectQuery: FilterQuery;
  sprintQuery: FilterQuery;
  typeQuery: FilterQuery;
  assigneeQuery: FilterQuery;
  sprintOptions: { readonly value: string; readonly label: string }[];
  // eslint-disable-next-line no-unused-vars
  onProjectChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars
  onListViewChange: (view: WorkItemListView) => void;
  rootCount: number;
  isExpandingAll: boolean;
  expandedCount: number;
  onExpandAll: () => Promise<void>;
  onCollapseAll: () => void;
  showWorkspaceDefaults: boolean;
  onOpenDefaultsDialog: () => void;
  savedDefaultsApplied: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
}>) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={searchQuery}
          onValueChange={onSearchChange}
          placeholder="Search work items..."
        />

        {isProjectLocked ? null : (
          <ListFilterSelect
            value={projectQuery.value}
            onValueChange={onProjectChange}
            allValue={projectQuery.allValue}
            allLabel="All Projects"
            ariaLabel="Filter by project"
            placeholder="All Projects"
            triggerClassName="sm:w-44"
            options={projects.map((project) => ({
              value: project.id,
              label: project.name,
            }))}
          />
        )}

        {isProjectLocked ? null : (
          <ListFilterSelect
            value={sprintQuery.value}
            onValueChange={sprintQuery.setFilter}
            allValue={sprintQuery.allValue}
            allLabel="All Sprints"
            ariaLabel="Filter by sprint"
            placeholder="All Sprints"
            triggerClassName="sm:w-44"
            options={sprintOptions}
          />
        )}

        <ListFilterSelect
          value={typeQuery.value}
          onValueChange={typeQuery.setFilter}
          allValue={typeQuery.allValue}
          allLabel="All Types"
          ariaLabel="Filter by type"
          placeholder="All Types"
          triggerClassName="sm:w-36"
          options={WORK_ITEM_TYPES.map((workItemType) => ({
            value: workItemType,
            label: workItemType,
          }))}
        />

        {isAssigneeLocked ? null : (
          <ListFilterSelect
            value={assigneeQuery.value}
            onValueChange={assigneeQuery.setFilter}
            allValue={assigneeQuery.allValue}
            allLabel="All Assignees"
            ariaLabel="Filter by assignee"
            placeholder="All Assignees"
            triggerClassName="sm:w-44"
            options={projectMembers.map((member) => ({
              value: member.id,
              label: member.name,
            }))}
          />
        )}

        <WorkItemListViewToggle
          listView={isHierarchy ? 'hierarchy' : 'flat'}
          onListViewChange={onListViewChange}
        />

        {isHierarchy ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-9 cursor-pointer gap-1.5 px-3 text-xs"
              disabled={isExpandingAll || rootCount === 0}
              onClick={() => {
                void onExpandAll();
              }}
            >
              {isExpandingAll ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              <span>Expand all</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-9 cursor-pointer px-3 text-xs"
              disabled={expandedCount === 0}
              onClick={onCollapseAll}
            >
              Collapse all
            </Button>
          </div>
        ) : null}

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

      <Button onClick={onCreate} className="shrink-0 self-start">
        <Plus />
        Add Work-Item
      </Button>
    </div>
  );
}
