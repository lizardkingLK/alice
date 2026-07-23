'use client';

import { useMemo, useState } from 'react';
import {
  type CellContext,
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
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
import {
  Calendar,
  Pencil,
  Archive,
  RefreshCw,
  MoreHorizontal,
} from '@repo/ui/lib/icons';
import {
  Sprint,
  updateSprintStatus,
} from '@/app/sprints/_services/sprints.service';
import { Pagination } from '@/components/pagination';
import { DataTable } from '@/components/data-table';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { formatDate } from '@/app/_shared/utility';

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
  onTabChange?: (tab: 'active' | 'archived') => void;
  // eslint-disable-next-line no-unused-vars
  onPageChange: (page: number) => void;
  // eslint-disable-next-line no-unused-vars
  onLimitChange: (limit: number) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  // eslint-disable-next-line no-unused-vars
  onSprintUpdated?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onEditSprint?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onArchiveSprint?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onRestoreSprint?: (sprint: Sprint) => void;
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
  disabled?: boolean;
};

export function SprintStatusDropdown({
  sprint,
  onSprintUpdated,
  disabled = false,
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

  if (disabled) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wider uppercase',
          STATUS_STYLES[sprint.status]
        )}
      >
        {sprint.status}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={isUpdating}
          className={cn(
            'inline-flex h-auto cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wider uppercase transition-colors focus:outline-none disabled:opacity-50',
            STATUS_STYLES[sprint.status]
          )}
        >
          {sprint.status}
        </Button>
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
  // eslint-disable-next-line no-unused-vars
  onArchiveSprint?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onRestoreSprint?: (sprint: Sprint) => void;
};

/* eslint-disable no-unused-vars */
interface SprintTableMeta {
  readonly onSprintUpdated?: (sprint: Sprint) => void;
  readonly onEditSprint?: (sprint: Sprint) => void;
  readonly onArchiveSprint?: (sprint: Sprint) => void;
  readonly onRestoreSprint?: (sprint: Sprint) => void;
}

/* eslint-enable no-unused-vars */

function getSprintTableMeta(table: CellContext<Sprint, unknown>['table']) {
  return table.options.meta as SprintTableMeta;
}

function renderSprintNameCell({ row }: CellContext<Sprint, unknown>) {
  return (
    <div className="flex min-w-48 items-center gap-3">
      <div
        className={cn(
          'bg-primary/10 text-primary border-primary/20',
          'flex size-8 shrink-0 items-center justify-center',
          'rounded-lg border text-xs font-bold'
        )}
      >
        {row.original.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="space-y-1 font-medium">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-semibold">
            {row.original.name}
          </span>
        </div>
        {row.original.project ? (
          <p className="text-muted-foreground text-xs font-normal">
            Project:{' '}
            <span className="font-medium">{row.original.project.name}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function renderDurationCell({ row }: CellContext<Sprint, unknown>) {
  return (
    <span className="text-muted-foreground text-sm font-medium">
      {formatDate(row.original.startDate)} – {formatDate(row.original.endDate)}
    </span>
  );
}

function renderStatusCell({ row, table }: CellContext<Sprint, unknown>) {
  const meta = getSprintTableMeta(table);
  return (
    <SprintStatusDropdown
      sprint={row.original}
      onSprintUpdated={meta.onSprintUpdated}
      disabled={true}
    />
  );
}

function renderGoalCell({ row }: CellContext<Sprint, unknown>) {
  const goal = row.original.goal;
  if (!goal) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <TruncatedText className="text-muted-foreground max-w-xs text-sm">
      {goal}
    </TruncatedText>
  );
}

function renderActionsHeader() {
  return <span className="sr-only">Actions</span>;
}

function renderActionsCell({ row, table }: CellContext<Sprint, unknown>) {
  const meta = getSprintTableMeta(table);
  const sprint = row.original;
  const showEdit = meta.onEditSprint && sprint.status !== 'Archived';
  const showArchive = meta.onArchiveSprint && sprint.status === 'Completed';
  const showRestore = meta.onRestoreSprint && sprint.status === 'Archived';

  if (!showEdit && !showArchive && !showRestore) {
    return null;
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Open Actions Menu"
          >
            <MoreHorizontal />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showEdit ? (
            <DropdownMenuItem
              onClick={() => meta.onEditSprint?.(sprint)}
              aria-label="Edit Sprint"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          ) : null}
          {showArchive ? (
            <DropdownMenuItem
              onClick={() => meta.onArchiveSprint?.(sprint)}
              aria-label="Archive Sprint"
              className="text-rose-600 focus:bg-rose-50 focus:text-rose-600 dark:text-rose-400 dark:focus:bg-rose-950/20 dark:focus:text-rose-400"
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
          ) : null}
          {showRestore ? (
            <DropdownMenuItem
              onClick={() => meta.onRestoreSprint?.(sprint)}
              aria-label="Restore Sprint"
              className="text-emerald-600 focus:bg-emerald-50 focus:text-emerald-600 dark:text-emerald-400 dark:focus:bg-emerald-950/20 dark:focus:text-emerald-400"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Restore
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const SPRINT_COLUMNS: ColumnDef<Sprint>[] = [
  {
    accessorKey: 'name',
    header: 'Sprint Name',
    cell: renderSprintNameCell,
  },
  {
    id: 'duration',
    header: 'Duration',
    cell: renderDurationCell,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: renderStatusCell,
  },
  {
    accessorKey: 'goal',
    header: 'Goal',
    cell: renderGoalCell,
  },
  {
    id: 'actions',
    header: renderActionsHeader,
    cell: renderActionsCell,
  },
];

function SprintListContent({
  isLoading,
  error,
  sprintsCount,
  filteredSprints,
  filterTab,
  onRetry,
  onSprintUpdated,
  onEditSprint,
  onArchiveSprint,
  onRestoreSprint,
}: Readonly<SprintListContentProps>) {
  const tableMeta = useMemo<SprintTableMeta>(
    () => ({
      onSprintUpdated,
      onEditSprint,
      onArchiveSprint,
      onRestoreSprint,
    }),
    [onSprintUpdated, onEditSprint, onArchiveSprint, onRestoreSprint]
  );

  const table = useReactTable({
    data: filteredSprints,
    columns: SPRINT_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    meta: tableMeta,
  });

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
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
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
    <DataTable
      table={table}
      columnCount={SPRINT_COLUMNS.length}
      emptyState={
        <div className="flex flex-col items-center justify-center gap-2">
          <p>No sprints found matching your search.</p>
        </div>
      }
    />
  );
}

export function SprintList({
  sprints,
  pagination,
  filterTab,
  onTabChange,
  onPageChange,
  onLimitChange,
  isLoading = false,
  error = null,
  onRetry,
  onSprintUpdated,
  onEditSprint,
  onArchiveSprint,
  onRestoreSprint,
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
        {onTabChange && (
          <div className="bg-muted/50 border-border text-muted-foreground inline-flex h-10 items-center justify-center rounded-md border p-1">
            <Button
              variant="ghost"
              onClick={() => onTabChange('active')}
              className={cn(
                'h-8 cursor-pointer rounded-sm px-3 text-xs font-semibold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
                filterTab === 'active'
                  ? 'bg-background text-foreground hover:bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              )}
            >
              Active
            </Button>
            <Button
              variant="ghost"
              onClick={() => onTabChange('archived')}
              className={cn(
                'h-8 cursor-pointer rounded-sm px-3 text-xs font-semibold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
                filterTab === 'archived'
                  ? 'bg-background text-foreground hover:bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              )}
            >
              Archived
            </Button>
          </div>
        )}
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
          onArchiveSprint={onArchiveSprint}
          onRestoreSprint={onRestoreSprint}
        />
        {pagination && pagination.totalCount > 0 && (
          <Pagination
            totalCount={pagination.totalCount}
            page={pagination.page}
            limit={pagination.limit}
            totalPages={pagination.totalPages}
            onPageChange={onPageChange}
            onLimitChange={onLimitChange}
            label="sprints"
          />
        )}
      </CardContent>
    </Card>
  );
}
