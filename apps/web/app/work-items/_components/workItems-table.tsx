'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ColumnDef,
  getCoreRowModel,
  Row,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  ClipboardPenLine,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash,
  X,
} from '@repo/ui/lib/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { WorkItemForm } from '@/app/work-items/_components/workItem-form';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { WorkItemWorkspaceProps } from '@/app/work-items/_components/workItems-workspace';
import { formatDate } from '@/app/_shared/utility';
import statusRenderer from '@/app/work-items/_components/workItem-badge-status';
import priorityRenderer from '@/app/work-items/_components/workItem-badge-priority';
import Link from 'next/link';
import { cn } from '@repo/ui/lib/utils';
import { Pagination } from '@/components/pagination';
import { DataTable } from '@/components/data-table';
import { SearchInput } from '@/components/search-input';
import { DismissibleError } from '@/components/dismissible-error';
import { ListFilterSelect } from '@/components/list-filter-select';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { useQueryFilter } from '@/hooks/use-query-filter';
import { usePathname, useSearchParams } from 'next/navigation';
import { Constants } from '@repo/types/database';

/** Match DialogContent `duration-200` so edit UI doesn't flash to create while closing. */
const DIALOG_CLOSE_MS = 200;

const WORK_ITEM_FILTER_PARAMS = [
  'search',
  'project',
  'type',
  'assignee',
] as const;

type WorkItemsTableProps = WorkItemWorkspaceProps & {
  currentUserId?: string | null;
};

export type RendererProps = { row: Row<DbWorkItem> };

const titleRenderer = ({ row }: RendererProps) => (
  <Link
    className="flex min-w-48 items-center gap-3"
    href={`/work-items/${row.original.id}`}
  >
    <div
      className={cn(
        'bg-primary/10 text-primary border-primary/20',
        'flex size-8 shrink-0 items-center justify-center',
        'rounded-lg border text-xs font-bold'
      )}
    >
      {row.original.title.slice(0, 1).toUpperCase()}
    </div>
    <div className="space-y-1 font-medium">
      {row.original.title}
      <p className="text-muted-foreground text-xs">
        Created {formatDate(row.original.created_at)}
      </p>
    </div>
  </Link>
);

const typeRenderer = ({ row }: RendererProps) => (
  <Badge variant="outline">{row.original.type}</Badge>
);

const assigneeRenderer = ({
  row,
  currentUserId,
}: RendererProps & { currentUserId?: string | null }) => {
  const assigneeName = row.original.assignee?.name ?? '—';
  const isAssignedToSelf = row.original.assignee_id === currentUserId;

  return (
    <div className="space-y-1">
      <p className="font-medium">{assigneeName}</p>
      {isAssignedToSelf ? (
        <Badge variant="secondary" className="text-[10px]">
          You
        </Badge>
      ) : null}
    </div>
  );
};

const dueDateRenderer = ({ row }: RendererProps) => (
  <span className="text-muted-foreground">
    {formatDate(row.original.due_date)}
  </span>
);

const actionsHeaderRenderer = () => <span className="sr-only">Actions</span>;

const actionsRenderer = ({
  row,
  openEditDialog,
  // eslint-disable-next-line no-unused-vars
}: RendererProps & { openEditDialog: (workItem: DbWorkItem) => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon-sm" className="cursor-pointer">
        <MoreHorizontal />
        <span className="sr-only">Open menu</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => openEditDialog(row.original)}>
        <Pencil />
        Edit
      </DropdownMenuItem>
      <DropdownMenuItem variant="destructive">
        <Trash />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const WORK_ITEM_TYPES = Constants.public.Enums.WorkItemType;

export default function WorkItemsTable({
  projects,
  projectMembers,
  initialWorkItems,
  totalCount,
  page,
  limit,
  totalPages,
  search,
  projectFilter,
  typeFilter,
  assigneeFilter,
  lockedProjectId,
  currentUserId,
}: Readonly<WorkItemsTableProps>) {
  const { handlePageChange, handleLimitChange, router } =
    usePaginationNavigation(totalPages, limit);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);
  const projectQuery = useQueryFilter('project', projectFilter);
  const typeQuery = useQueryFilter('type', typeFilter);
  const assigneeQuery = useQueryFilter('assignee', assigneeFilter);
  const isProjectLocked = Boolean(lockedProjectId);

  const hasActiveFilters = WORK_ITEM_FILTER_PARAMS.some((key) => {
    if (key === 'project' && isProjectLocked) {
      return false;
    }
    return Boolean(searchParams.get(key)?.trim());
  });

  const handleClearFilters = () => {
    setSearchQuery('');
    const next = new URLSearchParams();
    const limitParam = searchParams.get('limit');
    const tabParam = searchParams.get('tab');
    if (limitParam) {
      next.set('limit', limitParam);
    }
    if (tabParam) {
      next.set('tab', tabParam);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<DbWorkItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clearEditTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const isEditMode = itemToEdit !== null;
  const workItems = initialWorkItems;

  const cancelPendingEditClear = useCallback(() => {
    if (clearEditTimeoutRef.current) {
      clearTimeout(clearEditTimeoutRef.current);
      clearEditTimeoutRef.current = null;
    }
  }, []);

  const clearItemToEditAfterClose = useCallback(() => {
    cancelPendingEditClear();
    clearEditTimeoutRef.current = setTimeout(() => {
      setItemToEdit(null);
      clearEditTimeoutRef.current = null;
    }, DIALOG_CLOSE_MS);
  }, [cancelPendingEditClear]);

  useEffect(() => {
    return () => {
      cancelPendingEditClear();
    };
  }, [cancelPendingEditClear]);

  const openCreateDialog = () => {
    cancelPendingEditClear();
    setItemToEdit(null);
    setDialogOpen(true);
  };

  const openEditDialog = useCallback(
    (workItem: DbWorkItem) => {
      cancelPendingEditClear();
      setItemToEdit(workItem);
      setDialogOpen(true);
    },
    [cancelPendingEditClear]
  );

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      clearItemToEditAfterClose();
    }
  };

  const handleUpdated = useCallback(() => {
    setError(null);
    setDialogOpen(false);
    clearItemToEditAfterClose();
    router.refresh();
  }, [router, clearItemToEditAfterClose]);

  const columns = useMemo<ColumnDef<DbWorkItem>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: titleRenderer,
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: typeRenderer,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: statusRenderer,
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: priorityRenderer,
      },
      {
        id: 'assignee',
        header: 'Assignee',
        cell: ({ row }) => assigneeRenderer({ row, currentUserId }),
      },
      {
        accessorKey: 'due_date',
        header: 'Due Date',
        cell: dueDateRenderer,
      },
      {
        id: 'actions',
        header: actionsHeaderRenderer,
        cell: ({ row }) => actionsRenderer({ row, openEditDialog }),
      },
    ],
    [currentUserId, openEditDialog]
  );

  const table = useReactTable({
    data: workItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6">
      <DismissibleError message={error} onDismiss={() => setError(null)} />

      {/* Work-Items Options */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Search work items..."
          />

          {isProjectLocked ? null : (
            <ListFilterSelect
              value={projectQuery.value}
              onValueChange={projectQuery.setFilter}
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

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-muted-foreground hover:text-foreground h-9 cursor-pointer px-3 text-xs"
            >
              Clear filters
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>

        <Button onClick={openCreateDialog} className="shrink-0 self-start">
          <Plus />
          Add Work-Item
        </Button>
      </div>

      {/* Work-Items Table */}
      <Card className="border-border bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardPenLine className="text-primary size-5" />
            Work Items
          </CardTitle>
          <CardDescription>
            {isProjectLocked
              ? 'View, filter, and manage work items for this project.'
              : 'View, filter, and manage work items across your workspace.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            table={table}
            columnCount={columns.length}
            emptyState={
              <div className="flex flex-col items-center justify-center gap-2">
                <ClipboardPenLine className="text-muted-foreground/50 size-8 stroke-1" />
                <p>No work items found matching your search.</p>
              </div>
            }
          />

          <Pagination
            totalCount={totalCount}
            page={page}
            limit={limit}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            label="work items"
          />
        </CardContent>
      </Card>

      {/* Work-Item Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent
          className="sm:max-w-xl"
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Edit Work Item' : 'Create Work Item'}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? 'Update the details for this work item.'
                : 'Add a new work item and assign it to a team member.'}
            </DialogDescription>
          </DialogHeader>

          <WorkItemForm
            projects={projects}
            itemToEdit={itemToEdit}
            projectMembers={projectMembers}
            lockProject={isProjectLocked}
            onClose={() => handleDialogChange(false)}
            onSuccess={() => handleUpdated()}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
