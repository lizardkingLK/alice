'use client';

import { CheckCircle2, CircleDot, Layers, Plus } from '@repo/ui/lib/icons';
import {
  AppliedFilterBadges,
  type AppliedFilterBadgeItem,
} from '@/components/applied-filter-badges';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import {
  BacklogFilterDialog,
  type BacklogFilterDraft,
} from '@/app/backlog/_components/backlog-filter-dialog';
import { BacklogLayoutMenu } from '@/app/backlog/_components/backlog-layout-menu';
import type { BacklogLayoutId } from '@/app/backlog/_helpers/backlog-layout-storage';
import type { BacklogActiveTab } from '@/app/backlog/_helpers/backlog-item-utils';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import type { User as DbUser } from '@/app/users/_services/users.mutations.client';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';
import { RegistryTabSwitcher } from '@/components/registry-tab-switcher';
import { SearchInput } from '@/components/search-input';

/* eslint-disable no-unused-vars */
type BacklogToolbarProps = {
  readonly projects: DbProject[];
  readonly sprints: readonly Sprint[];
  readonly projectMembers: DbUser[];
  readonly isManagerOrAdmin: boolean;
  readonly activeTab: BacklogActiveTab;
  readonly onTabChange: (tab: BacklogActiveTab) => void;
  readonly preferredLayout: BacklogLayoutId;
  readonly onLayoutChange: (layout: BacklogLayoutId) => void;
  readonly onCreateSprint: () => void;
  readonly onCreateIssue: () => void;
  readonly searchQuery: string;
  readonly onSearchChange: (value: string) => void;
  readonly projectFilter: string;
  readonly onProjectFilterChange: (value: string, sprintValue?: string) => void;
  readonly sprintFilter: string;
  readonly onSprintFilterChange: (value: string) => void;
  readonly assigneeFilter: string;
  readonly onAssigneeFilterChange: (value: string) => void;
  readonly priorityFilter: string;
  readonly onPriorityFilterChange: (value: string) => void;
  readonly isFiltersActive: boolean;
  readonly appliedFilterItems: readonly AppliedFilterBadgeItem[];
  readonly onRemoveAppliedFilter: (ids: readonly string[]) => void;
  readonly onClearFilters: () => void;
  readonly onSaveWorkspaceDefaults?: (
    preference: BoardDefaultsPreference | null
  ) => void;
};
/* eslint-enable no-unused-vars */

const BACKLOG_TABS = [
  { id: 'active' as const, label: 'Active', icon: CircleDot },
  { id: 'completed' as const, label: 'Completed', icon: CheckCircle2 },
];

export function BacklogToolbar({
  projects,
  sprints,
  projectMembers,
  isManagerOrAdmin,
  activeTab,
  onTabChange,
  preferredLayout,
  onLayoutChange,
  onCreateSprint,
  onCreateIssue,
  searchQuery,
  onSearchChange,
  projectFilter,
  onProjectFilterChange,
  sprintFilter,
  onSprintFilterChange,
  assigneeFilter,
  onAssigneeFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  isFiltersActive,
  appliedFilterItems,
  onRemoveAppliedFilter,
  onClearFilters,
  onSaveWorkspaceDefaults,
}: Readonly<BacklogToolbarProps>) {
  const handleApplyFilters = (draft: BacklogFilterDraft) => {
    const nextSprint =
      draft.sprint === QUERY_FILTER_ALL_VALUE ? '' : draft.sprint;
    onProjectFilterChange(draft.project, nextSprint);
    onSprintFilterChange(nextSprint);
    onAssigneeFilterChange(draft.assignee);
    onPriorityFilterChange(draft.priority);
  };

  return (
    <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-3">
        <SearchInput
          value={searchQuery}
          onValueChange={onSearchChange}
          placeholder="Search backlog items..."
          className="shrink-0 sm:w-64"
        />

        <BacklogFilterDialog
          projects={projects}
          sprints={sprints}
          projectMembers={projectMembers}
          projectFilter={projectFilter}
          sprintFilter={sprintFilter}
          assigneeFilter={assigneeFilter}
          priorityFilter={priorityFilter}
          activeTab={activeTab}
          hasActiveFilters={isFiltersActive}
          onApplyFilters={handleApplyFilters}
          onSaveWorkspaceDefaults={onSaveWorkspaceDefaults}
        />

        {isFiltersActive ? (
          <AppliedFilterBadges
            items={appliedFilterItems}
            onRemove={onRemoveAppliedFilter}
            onClearAll={onClearFilters}
          />
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
        <BacklogLayoutMenu
          preferredLayout={preferredLayout}
          onLayoutChange={onLayoutChange}
        />

        <RegistryTabSwitcher
          tabs={BACKLOG_TABS}
          value={activeTab}
          onChange={onTabChange}
          aria-label="Backlog status"
        />

        <TooltipProvider delayDuration={200}>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    className="size-8 shrink-0 cursor-pointer"
                    aria-label="Create"
                  >
                    <Plus className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Create</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              {isManagerOrAdmin ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onSelect={onCreateSprint}
                >
                  <Layers className="size-4" />
                  Create Sprint
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={onCreateIssue}
              >
                <Plus className="size-4" />
                Create Work-Item
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
    </div>
  );
}
