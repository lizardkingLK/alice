'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  Eye,
  Inbox,
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  ShieldX,
  Trash2,
  UserPlus,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { formatDate } from '@/app/_shared/utility';
import { DataTable } from '@/components/data-table';
import { DismissibleError } from '@/components/dismissible-error';
import { Pagination } from '@/components/pagination';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import { SearchInput } from '@/components/search-input';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AccessAllowlistForm } from '@/app/access-allowlist/_components/access-allowlist-form';
import type { AccessRequestEntry } from '@/app/access-requests/_services/access-requests.mutations.shared';
import {
  deleteAccessRequestClient,
  denyAccessRequestClient,
} from '@/app/access-requests/_services/access-requests.mutations.client';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import { accessRequestProjectKeysFromValue } from '@repo/types';

function resolveRequestedProjectKeysForForm(
  entry: AccessRequestEntry | null | undefined,
  projects: readonly Project[]
): string[] {
  const requested = accessRequestProjectKeysFromValue(
    entry?.requested_project_keys
  );
  if (requested.length === 0 || projects.length === 0) {
    return requested;
  }
  const byUpper = new Map(
    projects.map((project) => [project.key.trim().toUpperCase(), project.key])
  );
  return requested
    .map((key) => byUpper.get(key) ?? key)
    .filter((key, index, all) => all.indexOf(key) === index);
}

function AccessRequestProjectKeyBadges({
  keys,
  empty = null,
  className,
}: Readonly<{
  keys: readonly string[];
  empty?: ReactNode;
  className?: string;
}>) {
  if (keys.length === 0) {
    return empty;
  }
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {keys.map((key) => (
        <Badge key={key} variant="outline" className="font-mono text-[11px]">
          {key}
        </Badge>
      ))}
    </div>
  );
}

function RequestedProjectsCell({
  entry,
}: Readonly<{ entry: AccessRequestEntry }>) {
  const keys = accessRequestProjectKeysFromValue(entry.requested_project_keys);
  return (
    <AccessRequestProjectKeyBadges
      keys={keys}
      className="max-w-48"
      empty={<span className="text-muted-foreground text-xs">—</span>}
    />
  );
}

function ActiveRequestSummary({
  entry,
}: Readonly<{ entry: AccessRequestEntry }>) {
  const keys = accessRequestProjectKeysFromValue(entry.requested_project_keys);
  return (
    <div className="space-y-3">
      {keys.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">
            Requested projects
          </span>
          <AccessRequestProjectKeyBadges keys={keys} />
        </div>
      ) : null}
      <div className="bg-muted max-h-48 overflow-y-auto rounded-md border p-3 font-mono text-xs whitespace-pre-wrap">
        {entry.message}
      </div>
    </div>
  );
}

interface AccessRequestsRegistryProps {
  readonly requests: AccessRequestEntry[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly search: string;
  readonly focusedRequest?: AccessRequestEntry | null;
  readonly projects?: readonly Project[];
}

type RequestRow = Row<AccessRequestEntry>;

const STATUS_BADGE_STYLES: Record<string, string> = {
  pending:
    'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  granted:
    'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  denied: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

function StatusBadge({ status }: Readonly<{ status: string }>) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'capitalize',
        STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.pending
      )}
    >
      {status}
    </Badge>
  );
}

function RequesterCell({ row }: Readonly<{ row: RequestRow }>) {
  const entry = row.original;
  return (
    <div className="min-w-48 space-y-0.5">
      <TruncatedText className="text-sm font-semibold">
        {entry.requester_email}
      </TruncatedText>
      {entry.requester_name ? (
        <TruncatedText className="text-muted-foreground text-xs">
          {entry.requester_name}
        </TruncatedText>
      ) : null}
    </div>
  );
}

interface ActionsCellProps {
  readonly row: RequestRow;
  readonly isBusy: boolean;
  // eslint-disable-next-line no-unused-vars -- callback param names for documentation
  readonly onReview: (entry: AccessRequestEntry) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onView: (entry: AccessRequestEntry) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onDeny: (entry: AccessRequestEntry) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onDelete: (entry: AccessRequestEntry) => void;
}

function ActionsCell({
  row,
  isBusy,
  onReview,
  onView,
  onDeny,
  onDelete,
}: Readonly<ActionsCellProps>) {
  const entry = row.original;
  const pending = entry.status === 'pending';

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
          {pending ? (
            <DropdownMenuItem onClick={() => onReview(entry)}>
              <UserPlus />
              Review
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onView(entry)}>
              <Eye />
              View
            </DropdownMenuItem>
          )}
          {pending ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDeny(entry)}
            >
              <ShieldX />
              Deny
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(entry)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const COLUMNS: ColumnDef<AccessRequestEntry>[] = [
  {
    id: 'requester',
    header: 'Requester',
    cell: ({ row }) => <RequesterCell row={row} />,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: 'projects',
    header: 'Projects',
    cell: ({ row }) => <RequestedProjectsCell entry={row.original} />,
  },
  {
    accessorKey: 'request_count',
    header: 'Submissions',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm tabular-nums">
        {row.original.request_count}
      </span>
    ),
  },
  {
    accessorKey: 'last_requested_at',
    header: 'Last requested',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {formatDate(row.original.last_requested_at)}
      </span>
    ),
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: (ctx: CellContext<AccessRequestEntry, unknown>) => {
      const meta = ctx.table.options.meta as RequestTableMeta | undefined;
      return (
        <ActionsCell
          row={ctx.row}
          isBusy={meta?.isBusy ?? false}
          onReview={meta?.onReview ?? (() => undefined)}
          onView={meta?.onView ?? (() => undefined)}
          onDeny={meta?.onDeny ?? (() => undefined)}
          onDelete={meta?.onDelete ?? (() => undefined)}
        />
      );
    },
  },
];

type RequestTableMeta = {
  isBusy: boolean;
  // eslint-disable-next-line no-unused-vars
  onReview: (entry: AccessRequestEntry) => void;
  // eslint-disable-next-line no-unused-vars
  onView: (entry: AccessRequestEntry) => void;
  // eslint-disable-next-line no-unused-vars
  onDeny: (entry: AccessRequestEntry) => void;
  // eslint-disable-next-line no-unused-vars
  onDelete: (entry: AccessRequestEntry) => void;
};

function buildResolvedDialog(entry: AccessRequestEntry): {
  title: string;
  body: ReactNode;
} {
  if (entry.status === 'granted') {
    return {
      title: 'Access already granted',
      body: (
        <p>
          Another admin has already granted workspace access to{' '}
          <span className="font-semibold">{entry.requester_email}</span>
          {entry.resolved_at ? ` on ${formatDate(entry.resolved_at)}.` : '.'}
        </p>
      ),
    };
  }

  return {
    title: 'Access request denied',
    body: (
      <p>
        This request from{' '}
        <span className="font-semibold">{entry.requester_email}</span> was
        denied
        {entry.resolved_at ? ` on ${formatDate(entry.resolved_at)}` : ''}
        {'.'}
      </p>
    ),
  };
}

/** Drop deep-link query keys without Next navigation (avoids RSC refresh). */
function clearRequestQueryParamsQuietly(
  searchParams: URLSearchParams,
  pathname: string
) {
  const params = new URLSearchParams(searchParams.toString());
  if (!params.has('requestId') && !params.has('addEmail')) {
    return;
  }
  params.delete('requestId');
  params.delete('addEmail');
  const query = params.toString();
  const url = query ? `${pathname}?${query}` : pathname;
  window.history.replaceState(window.history.state, '', url);
}

export function AccessRequestsRegistry({
  requests,
  totalCount,
  page,
  limit,
  totalPages,
  search,
  focusedRequest = null,
  projects = [],
}: Readonly<AccessRequestsRegistryProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestIdParam = searchParams.get('requestId');
  const addEmailParam = searchParams.get('addEmail');

  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);
  const { handlePageChange, handleLimitChange } = usePaginationNavigation(
    totalPages,
    limit
  );

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowDialogOpen, setAllowDialogOpen] = useState(false);
  const [resolvedDialog, setResolvedDialog] = useState<{
    title: string;
    body: ReactNode;
  } | null>(null);
  const [activeRequest, setActiveRequest] = useState<AccessRequestEntry | null>(
    null
  );
  const [deletingEntry, setDeletingEntry] = useState<AccessRequestEntry | null>(
    null
  );
  const dismissedDeepLinkIdRef = useRef<string | null>(null);

  const closeDialogsLocally = useCallback(() => {
    setAllowDialogOpen(false);
    setResolvedDialog(null);
    setActiveRequest(null);
  }, []);

  const clearDeepLinkParams = useCallback(() => {
    if (!requestIdParam && !addEmailParam) {
      return;
    }
    if (requestIdParam) {
      dismissedDeepLinkIdRef.current = requestIdParam;
    }
    clearRequestQueryParamsQuietly(searchParams, pathname);
  }, [addEmailParam, pathname, requestIdParam, searchParams]);

  /** Open Review / View from the row menu without touching the URL (no RSC refresh). */
  const openLocalDialog = useCallback((entry: AccessRequestEntry) => {
    setActiveRequest(entry);
    if (entry.status === 'pending') {
      setAllowDialogOpen(true);
      setResolvedDialog(null);
      return;
    }
    setAllowDialogOpen(false);
    setResolvedDialog(buildResolvedDialog(entry));
  }, []);

  const handleDeny = useCallback(
    (entry: AccessRequestEntry) => {
      setIsBusy(true);
      setError(null);
      denyAccessRequestClient(entry.id)
        .then(() => {
          closeDialogsLocally();
          clearDeepLinkParams();
          router.refresh();
        })
        .catch((denyError: unknown) => {
          const message =
            denyError instanceof Error
              ? denyError.message
              : 'Failed to deny access request.';
          setError(message);
        })
        .finally(() => {
          setIsBusy(false);
        });
    },
    [clearDeepLinkParams, closeDialogsLocally, router]
  );

  const confirmDelete = useCallback(() => {
    if (!deletingEntry) {
      return;
    }
    setIsBusy(true);
    setError(null);
    deleteAccessRequestClient(deletingEntry.id)
      .then(() => {
        setDeletingEntry(null);
        closeDialogsLocally();
        clearDeepLinkParams();
        router.refresh();
      })
      .catch((deleteError: unknown) => {
        const message =
          deleteError instanceof Error
            ? deleteError.message
            : 'Failed to delete access request.';
        setError(message);
      })
      .finally(() => {
        setIsBusy(false);
      });
  }, [clearDeepLinkParams, closeDialogsLocally, deletingEntry, router]);

  // Deep links from inbox / notification only — menu actions stay local.
  useEffect(() => {
    if (!requestIdParam) {
      dismissedDeepLinkIdRef.current = null;
      return;
    }
    if (dismissedDeepLinkIdRef.current === requestIdParam) {
      return;
    }

    const target =
      focusedRequest ??
      requests.find((row) => row.id === requestIdParam) ??
      null;

    if (!target || target.id !== requestIdParam) {
      return;
    }

    setActiveRequest(target);

    if (target.status === 'pending') {
      setAllowDialogOpen(true);
      setResolvedDialog(null);
      return;
    }

    setAllowDialogOpen(false);
    setResolvedDialog(buildResolvedDialog(target));
  }, [focusedRequest, requestIdParam, requests]);

  const handleCloseAllow = useCallback(() => {
    closeDialogsLocally();
    clearDeepLinkParams();
  }, [clearDeepLinkParams, closeDialogsLocally]);

  const handleAllowSuccess = useCallback(() => {
    closeDialogsLocally();
    clearDeepLinkParams();
    router.refresh();
  }, [clearDeepLinkParams, closeDialogsLocally, router]);

  const handleCloseResolved = useCallback(() => {
    closeDialogsLocally();
    clearDeepLinkParams();
  }, [clearDeepLinkParams, closeDialogsLocally]);

  const columns = useMemo(() => COLUMNS, []);

  const table = useReactTable({
    data: requests,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      isBusy,
      onReview: openLocalDialog,
      onView: openLocalDialog,
      onDeny: handleDeny,
      onDelete: setDeletingEntry,
    } satisfies RequestTableMeta,
  });

  return (
    <div className="space-y-6">
      <DismissibleError message={error} onDismiss={() => setError(null)} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search email, name, or message…"
        />
      </div>

      <Card className="border-border bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Inbox className="text-primary size-5" />
            Access requests
          </CardTitle>
          <CardDescription>
            Contact and access-denied admission requests. Review pending items
            to add an email allowlist entry (projects prefilled when requested)
            or deny explicitly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            table={table}
            columnCount={columns.length}
            rowClassName="hover:bg-accent/40"
            emptyState={
              <p className="text-muted-foreground py-8 text-center text-sm">
                No access requests match your filters.
              </p>
            }
          />
          <Pagination
            totalCount={totalCount}
            page={page}
            limit={limit}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            label="requests"
          />
        </CardContent>
      </Card>

      <Dialog
        open={allowDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseAllow();
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Allow access request</DialogTitle>
          <DialogDescription className="sr-only">
            Create an email allowlist entry for this requester.
          </DialogDescription>
          <AccessAllowlistForm
            projects={projects}
            onClose={handleCloseAllow}
            onSuccess={handleAllowSuccess}
            initialKind="email"
            initialValue={
              activeRequest?.requester_email ?? addEmailParam ?? undefined
            }
            initialProjectKeys={resolveRequestedProjectKeysForForm(
              activeRequest,
              projects
            )}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={resolvedDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseResolved();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="text-primary size-5 shrink-0" />
              {resolvedDialog?.title}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-muted-foreground text-sm">
                {resolvedDialog?.body}
              </div>
            </DialogDescription>
          </DialogHeader>
          {activeRequest ? (
            <ActiveRequestSummary entry={activeRequest} />
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={handleCloseResolved}
            >
              Okay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deletingEntry ? (
        <RegistryConfirmDialog
          title="Delete access request"
          subject={deletingEntry.requester_email}
          detail="This cannot be undone."
          confirmLabel="Delete"
          pendingLabel="Deleting…"
          isPending={isBusy}
          isSoft={false}
          actionVerb="delete"
          onCancel={() => {
            if (!isBusy) {
              setDeletingEntry(null);
            }
          }}
          onConfirm={confirmDelete}
        />
      ) : null}

      {isBusy ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <Loader2 className="text-primary size-8 animate-spin" />
        </div>
      ) : null}
    </div>
  );
}
