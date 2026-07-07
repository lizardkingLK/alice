'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { cn } from '@repo/ui/lib/utils';
import { Plus, Calendar, Pencil } from 'lucide-react';
import {
  Sprint,
  updateSprintStatus,
} from '@/app/sprints/_services/sprints.service';

type SprintListProps = {
  sprints: Sprint[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  filterTab: 'active' | 'archived';
  // eslint-disable-next-line no-unused-vars
  onTabChange: (tab: 'active' | 'archived') => void;
  // eslint-disable-next-line no-unused-vars
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  // eslint-disable-next-line no-unused-vars
  onSprintUpdated?: (sprint: Sprint) => void;
  onAddSprint?: () => void;
  // eslint-disable-next-line no-unused-vars
  onEditSprint?: (sprint: Sprint) => void;
};

const STATUS_STYLES = {
  'Not Started':
    'border-rose-500/20 bg-rose-500/10 text-rose-500 dark:border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-400',
  Ongoing:
    'border-blue-500/20 bg-blue-500/10 text-blue-500 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400',
  Completed:
    'border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400',
  Archived:
    'border-amber-500/20 bg-amber-500/10 text-amber-500 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400',
} as const;

const STATUSES = ['Not Started', 'Ongoing', 'Completed', 'Archived'] as const;

type SprintStatusDropdownProps = {
  sprint: Sprint;
  // eslint-disable-next-line no-unused-vars
  onSprintUpdated?: (sprint: Sprint) => void;
};

export function SprintStatusDropdown({
  sprint,
  onSprintUpdated,
}: Readonly<SprintStatusDropdownProps>) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (nextStatus: Sprint['status']) => {
    if (nextStatus === sprint.status) return;
    setIsUpdating(true);
    try {
      const updated = await updateSprintStatus(sprint.id, nextStatus);
      onSprintUpdated?.(updated);
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isUpdating}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wider uppercase transition-colors focus:outline-none disabled:opacity-50',
            STATUS_STYLES[sprint.status]
          )}
        >
          {sprint.status}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => handleStatusChange(status)}
            className="flex cursor-pointer items-center justify-between"
          >
            {status}
            {status === sprint.status && (
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  ).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type SprintListItemProps = {
  sprint: Sprint;
  // eslint-disable-next-line no-unused-vars
  onSprintUpdated?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onEditSprint?: (sprint: Sprint) => void;
};

function SprintListItem({
  sprint,
  onSprintUpdated,
  onEditSprint,
}: Readonly<SprintListItemProps>) {
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{sprint.name}</h3>
          {sprint.project ? (
            <span className="bg-secondary text-secondary-foreground ring-secondary/20 inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs font-medium ring-1 ring-inset">
              {sprint.project.key}
            </span>
          ) : null}
          <SprintStatusDropdown
            sprint={sprint}
            onSprintUpdated={onSprintUpdated}
          />
        </div>
        <p className="text-muted-foreground text-sm">
          {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
        </p>
      </div>
      {sprint.project ? (
        <p className="text-muted-foreground text-xs">
          Project: <span className="font-medium">{sprint.project.name}</span>
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        {sprint.goal ? (
          <p className="text-muted-foreground text-sm">{sprint.goal}</p>
        ) : (
          <div />
        )}
        {onEditSprint && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onEditSprint(sprint)}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Edit Sprint"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
    </li>
  );
}

type SprintTabsProps = {
  filterTab: 'active' | 'archived';
  // eslint-disable-next-line no-unused-vars
  setFilterTab: (tab: 'active' | 'archived') => void;
};

function SprintTabs({ filterTab, setFilterTab }: Readonly<SprintTabsProps>) {
  return (
    <div className="bg-muted/50 border-border text-muted-foreground inline-flex h-10 items-center justify-center rounded-md border p-1">
      <button
        onClick={() => setFilterTab('active')}
        className={`ring-offset-background inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${
          filterTab === 'active'
            ? 'bg-background text-foreground shadow-sm'
            : 'hover:text-foreground'
        }`}
      >
        Active
      </button>
      <button
        onClick={() => setFilterTab('archived')}
        className={`ring-offset-background inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${
          filterTab === 'archived'
            ? 'bg-background text-foreground shadow-sm'
            : 'hover:text-foreground'
        }`}
      >
        Archived
      </button>
    </div>
  );
}

type SprintListContentProps = {
  isLoading: boolean;
  error: string | null;
  sprintsCount: number;
  filteredSprints: Sprint[];
  filterTab: 'active' | 'archived';
  onRetry?: () => void;
  // eslint-disable-next-line no-unused-vars
  onSprintUpdated?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onEditSprint?: (sprint: Sprint) => void;
};

function SprintListContent({
  isLoading,
  error,
  sprintsCount,
  filteredSprints,
  filterTab,
  onRetry,
  onSprintUpdated,
  onEditSprint,
}: Readonly<SprintListContentProps>) {
  if (isLoading) {
    return (
      <div className="text-muted-foreground flex min-h-64 items-center justify-center text-sm">
        Loading sprints…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <p className="text-destructive text-sm">{error}</p>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
          >
            Try again
          </Button>
        ) : null}
      </div>
    );
  }

  if (sprintsCount === 0) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex min-h-64 items-center justify-center rounded-lg border border-dashed text-sm">
        No sprints yet. Create your first sprint to get started.
      </div>
    );
  }

  if (filteredSprints.length === 0) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex min-h-64 items-center justify-center rounded-lg border border-dashed text-sm">
        {filterTab === 'active'
          ? 'No active, upcoming, or completed sprints.'
          : 'No archived sprints.'}
      </div>
    );
  }

  return (
    <ul className="divide-border divide-y rounded-lg border">
      {filteredSprints.map((sprint) => (
        <SprintListItem
          key={sprint.id}
          sprint={sprint}
          onSprintUpdated={onSprintUpdated}
          onEditSprint={onEditSprint}
        />
      ))}
    </ul>
  );
}

export function SprintList({
  sprints,
  pagination,
  filterTab,
  onTabChange,
  onPageChange,
  isLoading = false,
  error = null,
  onRetry,
  onSprintUpdated,
  onAddSprint,
  onEditSprint,
}: Readonly<SprintListProps>) {
  const filteredSprints = sprints;

  return (
    <Card className="border-border bg-card/50 relative backdrop-blur-md">
      <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Calendar className="text-primary h-5 w-5" />
            Sprints
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            {filterTab === 'active'
              ? 'Active, upcoming, and completed sprints for your workspace.'
              : 'Archived sprints.'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <SprintTabs filterTab={filterTab} setFilterTab={onTabChange} />
          {onAddSprint && (
            <button
              type="button"
              onClick={onAddSprint}
              className="bg-primary text-primary-foreground hover:bg-primary/95 inline-flex h-10 cursor-pointer items-center justify-center rounded-md px-4 text-xs font-semibold shadow-md transition-all duration-300 hover:shadow-lg"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Sprint
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <SprintListContent
          isLoading={isLoading}
          error={error}
          sprintsCount={pagination.totalCount}
          filteredSprints={filteredSprints}
          filterTab={filterTab}
          onRetry={onRetry}
          onSprintUpdated={onSprintUpdated}
          onEditSprint={onEditSprint}
        />
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-muted-foreground text-sm">
              Showing page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || isLoading}
                onClick={() => onPageChange?.(pagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || isLoading}
                onClick={() => onPageChange?.(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
