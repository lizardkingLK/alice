'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  Row,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Input } from '@repo/ui/components/ui/input';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import {
  AlertTriangle,
  ClipboardPenLine,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash,
} from '@repo/ui/lib/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { WorkItemForm } from '@/app/work-items/_components/workItem-form';
import { DbWorkItem } from '@/app/work-items/_services/workItem.server.service';
import { WorkItemWorkspaceProps } from '@/app/work-items/_components/workItems-workspace';
import { formatDate } from '@/app/_shared/utility';
import statusRenderer from '@/app/work-items/_components/workItem-badge-status';
import priorityRenderer from '@/app/work-items/_components/workItem-badge-priority';
import Link from 'next/link';
import { cn } from '@repo/ui/lib/utils';
import { Pagination } from '@/components/pagination';
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
      {error ? (
        <div className="text-destructive bg-destructive/10 border-destructive/20 relative flex items-center gap-2 rounded-lg border p-3 text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setError(null)}
            className="ml-auto"
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {/* Work-Items Options */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search work items..."
            className="pl-9"
          />
        </div>

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
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="text-muted-foreground h-48 text-center"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ClipboardPenLine className="text-muted-foreground/50 size-8 stroke-1" />
                        <p>No work items found matching your search.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

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
