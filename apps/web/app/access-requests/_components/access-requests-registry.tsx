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
  Inbox,
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  ShieldX,
  UserPlus,
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
import { AccessAllowlistForm } from '@/app/access-allowlist/_components/access-allowlist-form';
import type { AccessRequestEntry } from '@/app/access-requests/_services/access-requests.mutations.shared';
import { denyAccessRequestClient } from '@/app/access-requests/_services/access-requests.mutations.client';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';

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
  readonly onDeny: (entry: AccessRequestEntry) => void;
}

function ActionsCell({
  row,
  isBusy,
  onReview,
  onDeny,
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
          <DropdownMenuItem onClick={() => onReview(entry)}>
            <UserPlus />
            {pending ? 'Review & allow' : 'View'}
          </DropdownMenuItem>
          {pending ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDeny(entry)}
            >
              <ShieldX />
              Deny
            </DropdownMenuItem>
          ) : null}
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
          onDeny={meta?.onDeny ?? (() => undefined)}
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
  onDeny: (entry: AccessRequestEntry) => void;
};

function clearRequestQueryParams(
  searchParams: URLSearchParams,
  pathname: string,
  router: ReturnType<typeof useRouter>
) {
  const params = new URLSearchParams(searchParams.toString());
  params.delete('requestId');
  params.delete('addEmail');
  const query = params.toString();
  router.replace(query ? `${pathname}?${query}` : pathname);
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

  const openReview = useCallback(
    (entry: AccessRequestEntry) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'requests');
      params.set('requestId', entry.id);
      params.set('addEmail', entry.requester_email);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const handleDeny = useCallback(
    (entry: AccessRequestEntry) => {
      setIsBusy(true);
      setError(null);
      denyAccessRequestClient(entry.id)
        .then(() => {
          clearRequestQueryParams(searchParams, pathname, router);
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
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const target =
      focusedRequest ??
      (requestIdParam
        ? (requests.find((row) => row.id === requestIdParam) ?? null)
        : null);

    if (target?.id !== requestIdParam) {
      return;
    }

    setActiveRequest(target);

    if (target.status === 'pending') {
      setAllowDialogOpen(true);
      setResolvedDialog(null);
      return;
    }

    setAllowDialogOpen(false);
    if (target.status === 'granted') {
      setResolvedDialog({
        title: 'Access already granted',
        body: (
          <p>
            Another admin has already granted workspace access to{' '}
            <span className="font-semibold">{target.requester_email}</span>
            {target.resolved_at
              ? ` on ${formatDate(target.resolved_at)}.`
              : '.'}
          </p>
        ),
      });
      return;
    }

    setResolvedDialog({
      title: 'Access request denied',
      body: (
        <p>
          This request from{' '}
          <span className="font-semibold">{target.requester_email}</span> was
          denied
          {target.resolved_at ? ` on ${formatDate(target.resolved_at)}` : ''}
          {'.'}
        </p>
      ),
    });
  }, [focusedRequest, requestIdParam, requests]);

  const handleCloseAllow = useCallback(() => {
    setAllowDialogOpen(false);
    setActiveRequest(null);
    clearRequestQueryParams(searchParams, pathname, router);
  }, [pathname, router, searchParams]);

  const handleAllowSuccess = useCallback(() => {
    setAllowDialogOpen(false);
    setActiveRequest(null);
    clearRequestQueryParams(searchParams, pathname, router);
    router.refresh();
  }, [pathname, router, searchParams]);

  const columns = useMemo(() => COLUMNS, []);

  const table = useReactTable({
    data: requests,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      isBusy,
      onReview: openReview,
      onDeny: handleDeny,
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
            Contact-form admission requests. Review pending items to add an
            email allowlist entry or deny explicitly.
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
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={resolvedDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResolvedDialog(null);
            clearRequestQueryParams(searchParams, pathname, router);
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
            <div className="bg-muted max-h-48 overflow-y-auto rounded-md border p-3 font-mono text-xs whitespace-pre-wrap">
              {activeRequest.message}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={() => {
                setResolvedDialog(null);
                clearRequestQueryParams(searchParams, pathname, router);
              }}
            >
              Okay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isBusy ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <Loader2 className="text-primary size-8 animate-spin" />
        </div>
      ) : null}
    </div>
  );
}
