'use client';

import { useMemo } from 'react';
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
import Link from 'next/link';
import {
  Calendar,
  Pencil,
  Archive,
  RefreshCw,
  MoreHorizontal,
  Trash2,
} from '@repo/ui/lib/icons';
import { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { SprintStatusEnum, SprintTabEnum, type SprintTab } from '@repo/types';
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
  filterTab: SprintTab;
  // eslint-disable-next-line no-unused-vars
  onPageChange: (page: number) => void;
  // eslint-disable-next-line no-unused-vars
  onLimitChange: (limit: number) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isAdmin?: boolean;
  isManagerOrAdmin?: boolean;
  // eslint-disable-next-line no-unused-vars
  onSprintUpdated?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onEditSprint?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onArchiveSprint?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onRestoreSprint?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onDeleteSprint?: (sprint: Sprint) => void;
};

const STATUS_STYLES = {
  [SprintStatusEnum.Planned]:
    'border-rose-500/20 bg-rose-500/10 text-rose-500 dark:border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-400',
  [SprintStatusEnum.Active]:
    'border-blue-500/20 bg-blue-500/10 text-blue-500 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400',
  [SprintStatusEnum.Closed]:
    'border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400',
  [SprintStatusEnum.Archived]:
    'border-amber-500/20 bg-amber-500/10 text-amber-500 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400',
} as const;

type SprintStatusDropdownProps = {
  sprint: Sprint;
};

export function SprintStatusDropdown({
  sprint,
}: Readonly<SprintStatusDropdownProps>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wider uppercase',
        STATUS_STYLES[sprint.status]
      )}
    >
      {(() => {
        switch (sprint.status) {
          case SprintStatusEnum.Planned:
            return 'Planned';
          case SprintStatusEnum.Active:
            return 'Active';
          case SprintStatusEnum.Closed:
            return 'Closed';
          default:
            return 'Archived';
        }
      })()}
    </span>
  );
}

type SprintListContentProps = {
  isLoading: boolean;
  error: string | null;
  sprintsCount: number;
  filteredSprints: Sprint[];
  filterTab: SprintTab;
  isAdmin?: boolean;
  isManagerOrAdmin?: boolean;
  onRetry?: () => void;
  // eslint-disable-next-line no-unused-vars
  onSprintUpdated?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onEditSprint?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onArchiveSprint?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onRestoreSprint?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars
  onDeleteSprint?: (sprint: Sprint) => void;
};

/* eslint-disable no-unused-vars */
interface SprintTableMeta {
  readonly onSprintUpdated?: (sprint: Sprint) => void;
  readonly onEditSprint?: (sprint: Sprint) => void;
  readonly onArchiveSprint?: (sprint: Sprint) => void;
  readonly onRestoreSprint?: (sprint: Sprint) => void;
  readonly onDeleteSprint?: (sprint: Sprint) => void;
  readonly isAdmin?: boolean;
  readonly isManagerOrAdmin?: boolean;
  readonly filterTab?: SprintTab;
}

/* eslint-enable no-unused-vars */

function getSprintTableMeta(table: CellContext<Sprint, unknown>['table']) {
  return table.options.meta as SprintTableMeta;
}

function renderSprintNameCell({ row }: CellContext<Sprint, unknown>) {
  return (
    <div className="flex min-w-48 items-center gap-3">
      <Link
        href={`/sprints/${row.original.id}/report`}
        className={cn(
          'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors',
          'flex size-8 shrink-0 items-center justify-center',
          'rounded-lg border text-xs font-bold'
        )}
      >
        {row.original.name.slice(0, 1).toUpperCase()}
      </Link>
      <div className="space-y-1 font-medium">
        <div className="flex items-center gap-2">
          <Link
            href={`/sprints/${row.original.id}/report`}
            className="text-foreground hover:text-primary font-semibold hover:underline transition-colors"
          >
            {row.original.name}
          </Link>
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

function renderStatusCell({ row }: CellContext<Sprint, unknown>) {
  return <SprintStatusDropdown sprint={row.original} />;
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
  const isArchived = sprint.status === SprintStatusEnum.Archived;
  const isCompleted = sprint.status === SprintStatusEnum.Closed;

  const showEdit = Boolean(meta.onEditSprint && !isArchived);
  const showArchive = Boolean(meta.onArchiveSprint && isCompleted);
  const showRestore = Boolean(meta.onRestoreSprint && isArchived);
  const showDelete = Boolean(
    meta.onDeleteSprint && isArchived && meta.isAdmin
  );

  if (!showEdit && !showArchive && !showRestore && !showDelete) {
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
              className="text-amber-600 focus:bg-amber-50 focus:text-amber-600 dark:text-amber-400 dark:focus:bg-amber-950/20 dark:focus:text-amber-400"
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
          {showDelete ? (
            <DropdownMenuItem
              onClick={() => meta.onDeleteSprint?.(sprint)}
              aria-label="Delete Sprint"
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
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
  isAdmin,
  isManagerOrAdmin,
  onRetry,
  onSprintUpdated,
  onEditSprint,
  onArchiveSprint,
  onRestoreSprint,
  onDeleteSprint,
}: Readonly<SprintListContentProps>) {
  const tableMeta = useMemo<SprintTableMeta>(
    () => ({
      onSprintUpdated,
      onEditSprint,
      onArchiveSprint,
      onRestoreSprint,
      onDeleteSprint,
      isAdmin,
      isManagerOrAdmin,
      filterTab,
    }),
    [
      onSprintUpdated,
      onEditSprint,
      onArchiveSprint,
      onRestoreSprint,
      onDeleteSprint,
      isAdmin,
      isManagerOrAdmin,
      filterTab,
    ]
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
        {filterTab === SprintTabEnum.Active
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
  onPageChange,
  onLimitChange,
  isLoading = false,
  error = null,
  isAdmin,
  isManagerOrAdmin,
  onRetry,
  onSprintUpdated,
  onEditSprint,
  onArchiveSprint,
  onRestoreSprint,
  onDeleteSprint,
}: Readonly<SprintListProps>) {
  const filteredSprints = sprints;

  return (
    <Card className="border-border bg-card/50 relative backdrop-blur-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Calendar className="text-primary h-5 w-5" />
          Sprints
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          {filterTab === SprintTabEnum.Active
            ? 'Active, upcoming, and completed sprints for your workspace.'
            : 'Archived sprints.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SprintListContent
          isLoading={isLoading}
          error={error}
          sprintsCount={pagination.totalCount}
          filteredSprints={filteredSprints}
          filterTab={filterTab}
          isAdmin={isAdmin}
          isManagerOrAdmin={isManagerOrAdmin}
          onRetry={onRetry}
          onSprintUpdated={onSprintUpdated}
          onEditSprint={onEditSprint}
          onArchiveSprint={onArchiveSprint}
          onRestoreSprint={onRestoreSprint}
          onDeleteSprint={onDeleteSprint}
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
