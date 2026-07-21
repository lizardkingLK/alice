'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';

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

export default function WorkItemsTable({
  projects,
  projectMembers,
  initialWorkItems,
  totalCount,
  page,
  limit,
  totalPages,
  search,
  currentUserId,
}: Readonly<WorkItemsTableProps>) {
  const { handlePageChange, handleLimitChange, router } =
    usePaginationNavigation(totalPages, limit);
  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<DbWorkItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = itemToEdit !== null;
  const workItems = initialWorkItems;

  const openCreateDialog = () => {
    setItemToEdit(null);
    setDialogOpen(true);
  };

  const openEditDialog = useCallback((workItem: DbWorkItem) => {
    setItemToEdit(workItem);
    setDialogOpen(true);
  }, []);

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setItemToEdit(null);
    }
  };

  const handleUpdated = useCallback(() => {
    setError(null);
    setDialogOpen(false);
    setItemToEdit(null);
    router.refresh();
  }, [router]);

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search work items..."
        />

        <Button onClick={openCreateDialog}>
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
            View, filter, and manage work items across your workspace.
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
        <DialogContent className="sm:max-w-xl">
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
            onClose={() => handleDialogChange(false)}
            onSuccess={() => handleUpdated()}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
