'use client';

import { cn } from '@repo/ui/lib/utils';
import { Layers, Plus, Search, X } from '@repo/ui/lib/icons';
import { WorkspaceDefaultsControls } from '@/app/board/_components/workspace-defaults-controls';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { BacklogLayoutMenu } from '@/app/backlog/_components/backlog-layout-menu';
import type { BacklogLayoutId } from '@/app/backlog/_helpers/backlog-layout-storage';
import type { BacklogActiveTab } from '@/app/backlog/_helpers/backlog-item-utils';
import type { Project as DbProject } from '@/app/projects/_services/projects.service';
import type { User as DbUser } from '@/app/users/_services/users.service';

/* eslint-disable no-unused-vars */
type BacklogToolbarProps = {
  readonly projects: DbProject[];
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
  readonly onProjectFilterChange: (value: string) => void;
  readonly assigneeFilter: string;
  readonly onAssigneeFilterChange: (value: string) => void;
  readonly priorityFilter: string;
  readonly onPriorityFilterChange: (value: string) => void;
  readonly isFiltersActive: boolean;
  readonly onClearFilters: () => void;
  readonly showDefaultsControls: boolean;
  readonly savedDefaultsApplied: boolean;
  readonly onOpenDefaultsDialog: () => void;
};
/* eslint-enable no-unused-vars */

const TAB_BUTTON_CLASS =
  'h-7 cursor-pointer rounded-sm px-3 text-xs font-semibold transition-all';

export function BacklogToolbar({
  projects,
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
  assigneeFilter,
  onAssigneeFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  isFiltersActive,
  onClearFilters,
  showDefaultsControls,
  savedDefaultsApplied,
  onOpenDefaultsDialog,
}: Readonly<BacklogToolbarProps>) {
  return (
    <div className="bg-card/40 border-border/60 flex flex-col gap-4 rounded-xl border p-4 shadow-sm backdrop-blur-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Layers className="text-primary size-5" />
          <h2 className="text-foreground text-xl font-bold tracking-tight">
            Sprint Planning
          </h2>

          <div className="bg-muted/50 border-border text-muted-foreground ml-4 inline-flex h-9 items-center justify-center rounded-md border p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTabChange('active')}
              className={cn(
                TAB_BUTTON_CLASS,
                activeTab === 'active'
                  ? 'bg-background text-foreground hover:bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              )}
            >
              Active
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTabChange('completed')}
              className={cn(
                TAB_BUTTON_CLASS,
                activeTab === 'completed'
                  ? 'bg-background text-foreground hover:bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              )}
            >
              Completed
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <BacklogLayoutMenu
            preferredLayout={preferredLayout}
            onLayoutChange={onLayoutChange}
          />
          {isManagerOrAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={onCreateSprint}
            >
              <Plus className="mr-1.5 size-4" />
              Create Sprint
            </Button>
          )}
          <Button size="sm" className="cursor-pointer" onClick={onCreateIssue}>
            <Plus className="mr-1.5 size-4" />
            Create Issue
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search backlog issues..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-background/50 border-border/80 focus-visible:border-ring h-9 pl-9 transition-colors"
          />
        </div>

        <Select value={projectFilter} onValueChange={onProjectFilterChange}>
          <SelectTrigger className="bg-background/50 border-border/80 h-9 w-37.5 text-xs">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((proj) => (
              <SelectItem key={proj.id} value={proj.id}>
                {proj.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assigneeFilter} onValueChange={onAssigneeFilterChange}>
          <SelectTrigger className="bg-background/50 border-border/80 h-9 w-40 text-xs">
            <SelectValue placeholder="All Assignees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            {projectMembers.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={onPriorityFilterChange}>
          <SelectTrigger className="bg-background/50 border-border/80 h-9 w-35 text-xs">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        {isFiltersActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground h-9 cursor-pointer px-3 text-xs"
          >
            Clear Filters
            <X className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}

        {showDefaultsControls ? (
          <WorkspaceDefaultsControls
            className="ml-auto flex items-center gap-1.5 sm:ml-0"
            buttonClassName="h-9 cursor-pointer"
            onOpenDefaultsDialog={onOpenDefaultsDialog}
            savedDefaultsApplied={savedDefaultsApplied}
          />
        ) : null}
      </div>
    </div>
  );
}
