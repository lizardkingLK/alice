'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type CellContext,
  type ColumnDef,
  getCoreRowModel,
  type Row,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  AlertTriangle,
  Calendar,
  Globe,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Shield,
  Trash2,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { formatDate } from '@/app/_shared/utility';
import { DataTable } from '@/components/data-table';
import { DismissibleError } from '@/components/dismissible-error';
import { Pagination } from '@/components/pagination';
import { SearchInput } from '@/components/search-input';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  isActorOwnAllowlistDomain,
  OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE,
} from '@repo/types';
import {
  deleteAccessAllowlistEntry,
  type AccessAllowlistEntry,
} from '@/app/access-allowlist/_services/access-allowlist.mutations.client';
import { AccessAllowlistForm } from '@/app/access-allowlist/_components/access-allowlist-form';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';

interface AccessAllowlistRegistryProps {
  readonly entries: AccessAllowlistEntry[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly search: string;
  readonly currentUserEmail?: string | null;
  readonly projects?: readonly Project[];
}

type AllowlistRow = Row<AccessAllowlistEntry>;

const KIND_BADGE_STYLES: Record<string, string> = {
  domain: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  email:
    'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400',
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  active:
    'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  inactive:
    'border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400',
  archived:
    'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  deleted: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

function KindBadge({ kind }: Readonly<{ kind: string }>) {
  const Icon = kind === 'email' ? Mail : Globe;
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 capitalize',
        KIND_BADGE_STYLES[kind] ?? KIND_BADGE_STYLES.domain
      )}
    >
      <Icon className="size-3 shrink-0" />
      {kind}
    </Badge>
  );
}

function StatusBadge({ status }: Readonly<{ status: string }>) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'capitalize',
        STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.inactive
      )}
    >
      {status}
    </Badge>
  );
}

function ValueCell({ row }: Readonly<{ row: AllowlistRow }>) {
  const entry = row.original;
  return (
    <div className="min-w-48 space-y-0.5">
      <TruncatedText className="text-sm font-semibold">
        {entry.value}
      </TruncatedText>
      {entry.label ? (
        <TruncatedText className="text-muted-foreground text-xs">
          {entry.label}
        </TruncatedText>
      ) : null}
    </div>
  );
}

function ExpiresCell({ row }: Readonly<{ row: AllowlistRow }>) {
  const expiresAt = row.original.expires_at;
  return (
    <div className="text-muted-foreground flex items-center gap-1 text-xs">
      <Calendar className="size-3 shrink-0" />
      {expiresAt ? formatDate(expiresAt) : 'Never'}
    </div>
  );
}

/* eslint-disable no-unused-vars */
interface ActionsCellProps {
  readonly row: AllowlistRow;
  readonly isBusy: boolean;
  readonly onEdit: (entry: AccessAllowlistEntry) => void;
  readonly onDelete: (entry: AccessAllowlistEntry) => void;
  readonly canDelete: boolean;
}
/* eslint-enable no-unused-vars */

function ActionsCell({
  row,
  isBusy,
  onEdit,
  onDelete,
  canDelete,
}: Readonly<ActionsCellProps>) {
  const entry = row.original;

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isBusy}
            className="cursor-pointer"
          >
            <MoreHorizontal />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(entry)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={!canDelete}
            title={canDelete ? undefined : OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE}
            onClick={() => {
              if (!canDelete) {
                return;
              }
              onDelete(entry);
            }}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* eslint-disable no-unused-vars */
interface AllowlistTableMeta {
  readonly isBusy: boolean;
  readonly onEdit: (entry: AccessAllowlistEntry) => void;
  readonly onDelete: (entry: AccessAllowlistEntry) => void;
  readonly currentUserEmail?: string | null;
}

type AllowlistCellRenderer = (
  context: CellContext<AccessAllowlistEntry, unknown>
) => ReactNode;
/* eslint-enable no-unused-vars */

function getAllowlistTableMeta(
  table: CellContext<AccessAllowlistEntry, unknown>['table']
) {
  return table.options.meta as AllowlistTableMeta;
}

const CELL_RENDERERS: Record<string, AllowlistCellRenderer> = {
  kind: ({ row }) => <KindBadge kind={row.original.kind} />,
  value: ({ row }) => <ValueCell row={row} />,
  status: ({ row }) => <StatusBadge status={row.original.status} />,
  expires: ({ row }) => <ExpiresCell row={row} />,
  actions: ({ row, table }) => {
    const meta = getAllowlistTableMeta(table);
    return (
      <ActionsCell
        row={row}
        isBusy={meta.isBusy}
        onEdit={meta.onEdit}
        onDelete={meta.onDelete}
        canDelete={
          !isActorOwnAllowlistDomain(row.original, meta.currentUserEmail)
        }
      />
    );
  },
};

const renderActionsHeader = () => <span className="sr-only">Actions</span>;

const COLUMNS: ColumnDef<AccessAllowlistEntry>[] = [
  { accessorKey: 'kind', header: 'Kind', cell: CELL_RENDERERS.kind },
  { accessorKey: 'value', header: 'Value', cell: CELL_RENDERERS.value },
  { accessorKey: 'status', header: 'Status', cell: CELL_RENDERERS.status },
  {
    accessorKey: 'expires_at',
    header: 'Expires',
    cell: CELL_RENDERERS.expires,
  },
  {
    id: 'actions',
    header: renderActionsHeader,
    cell: CELL_RENDERERS.actions,
  },
];

export function AccessAllowlistRegistry({
  entries,
  totalCount,
  page,
  limit,
  totalPages,
  search,
  currentUserEmail = null,
  projects = [],
}: Readonly<AccessAllowlistRegistryProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const addEmailParam = searchParams.get('addEmail');

  const { handlePageChange, handleLimitChange } = usePaginationNavigation(
    totalPages,
    limit
  );
  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AccessAllowlistEntry | null>(
    null
  );
  const [deletingEntry, setDeletingEntry] =
    useState<AccessAllowlistEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (addEmailParam) {
      setIsAddOpen(true);
    }
  }, [addEmailParam]);

  const handleCloseAdd = useCallback(() => {
    setIsAddOpen(false);
    if (addEmailParam) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('addEmail');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }
  }, [searchParams, addEmailParam, pathname, router]);

  const handleSuccessAdd = useCallback(() => {
    setIsAddOpen(false);
    if (addEmailParam) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('addEmail');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }
    router.refresh();
  }, [searchParams, addEmailParam, pathname, router]);

  const openEditDialog = useCallback((entry: AccessAllowlistEntry) => {
    setEditingEntry(entry);
  }, []);

  const openDeleteDialog = useCallback((entry: AccessAllowlistEntry) => {
    setDeletingEntry(entry);
    setError(null);
  }, []);

  const confirmDelete = () => {
    if (!deletingEntry) return;
    if (isActorOwnAllowlistDomain(deletingEntry, currentUserEmail)) {
      setError(OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE);
      setDeletingEntry(null);
      return;
    }
    setIsBusy(true);
    deleteAccessAllowlistEntry(deletingEntry.id, deletingEntry.updated_at)
      .then(() => {
        setDeletingEntry(null);
        setError(null);
        router.refresh();
      })
      .catch((deleteError: unknown) => {
        const message =
          deleteError instanceof Error
            ? deleteError.message
            : 'Failed to delete allowlist entry.';
        setError(message);
      })
      .finally(() => {
        setIsBusy(false);
      });
  };

  const columns = useMemo(() => COLUMNS, []);

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      isBusy,
      onEdit: openEditDialog,
      onDelete: openDeleteDialog,
      currentUserEmail,
    } satisfies AllowlistTableMeta,
  });

  return (
    <div className="space-y-6">
      <DismissibleError message={error} onDismiss={() => setError(null)} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search domains, emails, or labels…"
        />
        <Button onClick={() => setIsAddOpen(true)} className="cursor-pointer">
          <Plus />
          Add entry
        </Button>
      </div>

      <Card className="border-border bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Shield className="text-primary size-5" />
            Access allowlist
          </CardTitle>
          <CardDescription>
            Domains and exact emails approved for sign-up and sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            table={table}
            columnCount={columns.length}
            rowClassName="hover:bg-accent/40"
            emptyState={
              <div className="flex flex-col items-center justify-center gap-2">
                <Shield className="text-muted-foreground/50 size-8 stroke-1" />
                <p>No allowlist entries found matching the criteria.</p>
                <p className="text-muted-foreground/75 text-xs">
                  Add a company domain or a specific email to get started.
                </p>
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
            label="entries"
          />
        </CardContent>
      </Card>

      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseAdd();
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Add allowlist entry</DialogTitle>
          <DialogDescription className="sr-only">
            Create a domain or email admission rule.
          </DialogDescription>
          <AccessAllowlistForm
            projects={projects}
            onClose={handleCloseAdd}
            onSuccess={handleSuccessAdd}
            initialKind={addEmailParam ? 'email' : undefined}
            initialValue={addEmailParam ?? undefined}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingEntry !== null}
        onOpenChange={(open) => {
          if (!open) setEditingEntry(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Edit allowlist entry</DialogTitle>
          <DialogDescription className="sr-only">
            Update label, expiry, or status for this admission rule.
          </DialogDescription>
          {editingEntry ? (
            <AccessAllowlistForm
              entry={editingEntry}
              currentUserEmail={currentUserEmail}
              projects={projects}
              onClose={() => setEditingEntry(null)}
              onSuccess={() => {
                setEditingEntry(null);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingEntry !== null}
        onOpenChange={(open) => {
          if (!open && !isBusy) setDeletingEntry(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="size-5 shrink-0" />
              Delete allowlist entry
            </DialogTitle>
            <DialogDescription>
              {deletingEntry
                ? `Delete ${deletingEntry.kind} "${deletingEntry.value}"? This cannot be undone. Matching emails will no longer be admitted.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => setDeletingEntry(null)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isBusy}
              onClick={confirmDelete}
              className="cursor-pointer bg-rose-600 text-white hover:bg-rose-700"
            >
              {isBusy ? (
                <>
                  <Loader2 className="animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
