'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  Archive,
  Layers,
  MoreHorizontal,
  RefreshCw,
  Share2,
  Trash2,
  X,
} from '@repo/ui/lib/icons';
import { DataTable } from '@/components/data-table';
import { DismissibleError } from '@/components/dismissible-error';
import { Pagination } from '@/components/pagination';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import { RegistryTitleCell } from '@/components/registry-title-cell';
import { SearchInput } from '@/components/search-input';
import { cn } from '@repo/ui/lib/utils';
import { formatDate, formatDateTime } from '@/app/_shared/utility';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { afterDialogClose } from '@/lib/dialog-close';
import type { ViewsListTab } from '@/lib/search-params';
import {
  archiveSavedView,
  buildSavedViewHref,
  deleteSavedView,
  deleteSharedView,
  restoreSavedView,
  type SavedView,
} from '@/app/views/_services/saved-views.mutations.client';
import { emitSavedViewsChanged } from '@/app/views/_hooks/use-saved-views-nav';
import { ShareViewDialog } from '@/app/views/_components/share-view-dialog';
import { ViewsColumnsDialog } from '@/app/views/_components/views-columns-dialog';
import {
  DEFAULT_VIEWS_TABLE_COLUMN_VISIBILITY,
  normalizeViewsTableColumnVisibility,
  readViewsTableColumnVisibility,
  writeViewsTableColumnVisibility,
} from '@/app/views/_helpers/views-table-columns-storage';

const TABS: ReadonlyArray<{ id: ViewsListTab; label: string }> = [
  { id: 'mine', label: 'My views' },
  { id: 'shared', label: 'Shared with me' },
  { id: 'archived', label: 'Archived' },
];

function emptyViewsMessage(tab: ViewsListTab): string {
  if (tab === 'shared') {
    return 'No views have been shared with you yet.';
  }
  if (tab === 'archived') {
    return 'No archived views.';
  }
  return 'No saved views yet. Use the Layers icon in the header to save one.';
}

type DeleteTarget =
  | { readonly kind: 'view'; readonly view: SavedView }
  | { readonly kind: 'share'; readonly view: SavedView };

type ViewsWorkspaceProps = {
  readonly views: SavedView[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly tab: ViewsListTab;
  readonly search: string;
  readonly currentUserId: string | null;
  readonly shareProjects: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
};

function ViewsTitleCell({ view }: Readonly<{ view: SavedView }>) {
  const href = buildSavedViewHref(view.pathname, view.search);
  return (
    <RegistryTitleCell
      href={href}
      title={view.title}
      subtitle={`Updated ${formatDate(view.updated_at)}`}
    />
  );
}

function ViewsDescriptionCell({ view }: Readonly<{ view: SavedView }>) {
  return (
    <TruncatedText className="text-muted-foreground max-w-xs">
      {view.description || '—'}
    </TruncatedText>
  );
}

function ViewsPathCell({ view }: Readonly<{ view: SavedView }>) {
  const href = buildSavedViewHref(view.pathname, view.search);
  return (
    <TruncatedText className="text-muted-foreground block max-w-xs min-w-0 font-mono text-xs">
      {href}
    </TruncatedText>
  );
}

function ViewsUpdatedAtCell({ view }: Readonly<{ view: SavedView }>) {
  return (
    <span className="text-muted-foreground">
      {formatDateTime(view.updated_at)}
    </span>
  );
}

type ViewsActionsCellProps = {
  readonly view: SavedView;
  readonly tab: ViewsListTab;
  readonly pendingId: string | null;
  // eslint-disable-next-line no-unused-vars -- share open callback
  readonly onShare: (view: SavedView) => void;
  // eslint-disable-next-line no-unused-vars -- archive callback
  readonly onArchive: (view: SavedView) => void;
  // eslint-disable-next-line no-unused-vars -- restore callback
  readonly onRestore: (view: SavedView) => void;
  // eslint-disable-next-line no-unused-vars -- delete target callback
  readonly onRequestDelete: (target: DeleteTarget) => void;
};

function ViewsActionsCell({
  view,
  tab,
  pendingId,
  onShare,
  onArchive,
  onRestore,
  onRequestDelete,
}: Readonly<ViewsActionsCellProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={pendingId === view.id}
          aria-label="Open row actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {tab === 'mine' ? (
          <DropdownMenuItem onClick={() => onShare(view)}>
            <Share2 className="size-4" />
            Share
          </DropdownMenuItem>
        ) : null}
        {tab === 'mine' ? (
          <DropdownMenuItem onClick={() => onArchive(view)}>
            <Archive className="size-4" />
            Archive
          </DropdownMenuItem>
        ) : null}
        {tab === 'shared' ? (
          <DropdownMenuItem
            onClick={() => onRequestDelete({ kind: 'share', view })}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        ) : null}
        {tab === 'archived' ? (
          <DropdownMenuItem onClick={() => onRestore(view)}>
            <RefreshCw className="size-4" />
            Restore
          </DropdownMenuItem>
        ) : null}
        {tab === 'archived' ? (
          <DropdownMenuItem
            onClick={() => onRequestDelete({ kind: 'view', view })}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type ViewsTableColumnsOptions = Omit<ViewsActionsCellProps, 'view'>;

function renderViewsTitleCell({
  row,
}: {
  readonly row: { readonly original: SavedView };
}) {
  return <ViewsTitleCell view={row.original} />;
}

function renderViewsDescriptionCell({
  row,
}: {
  readonly row: { readonly original: SavedView };
}) {
  return <ViewsDescriptionCell view={row.original} />;
}

function renderViewsPathCell({
  row,
}: {
  readonly row: { readonly original: SavedView };
}) {
  return <ViewsPathCell view={row.original} />;
}

function renderViewsUpdatedAtCell({
  row,
}: {
  readonly row: { readonly original: SavedView };
}) {
  return <ViewsUpdatedAtCell view={row.original} />;
}

function createViewsTableColumns(
  options: ViewsTableColumnsOptions
): ColumnDef<SavedView>[] {
  function renderViewsActionsCell({
    row,
  }: {
    readonly row: { readonly original: SavedView };
  }) {
    return <ViewsActionsCell view={row.original} {...options} />;
  }

  return [
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Title',
      cell: renderViewsTitleCell,
    },
    {
      id: 'description',
      accessorKey: 'description',
      header: 'Description',
      cell: renderViewsDescriptionCell,
    },
    {
      id: 'path',
      header: 'Path',
      cell: renderViewsPathCell,
    },
    {
      id: 'updated_at',
      accessorKey: 'updated_at',
      header: 'Updated',
      cell: renderViewsUpdatedAtCell,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: renderViewsActionsCell,
    },
  ];
}

export function ViewsWorkspace({
  views,
  totalCount,
  page,
  limit,
  totalPages,
  tab,
  search,
  currentUserId,
  shareProjects,
}: Readonly<ViewsWorkspaceProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [shareView, setShareView] = useState<SavedView | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [viewToDelete, setViewToDelete] = useState<DeleteTarget | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => ({ ...DEFAULT_VIEWS_TABLE_COLUMN_VISIBILITY })
  );
  const [columnsHydrated, setColumnsHydrated] = useState(false);

  const { handlePageChange, handleLimitChange } = usePaginationNavigation(
    totalPages,
    limit
  );
  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);

  useEffect(() => {
    setColumnVisibility(readViewsTableColumnVisibility(currentUserId));
    setColumnsHydrated(true);
  }, [currentUserId]);

  const handleApplyColumnVisibility = useCallback(
    (next: VisibilityState) => {
      const normalized = normalizeViewsTableColumnVisibility(next);
      setColumnVisibility(normalized);
      writeViewsTableColumnVisibility(currentUserId, normalized);
    },
    [currentUserId]
  );

  const handleTabChange = useCallback(
    (nextTab: ViewsListTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextTab === 'mine') {
        params.delete('tab');
      } else {
        params.set('tab', nextTab);
      }
      params.set('page', '1');
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  const hasActiveSearch = Boolean(search.trim());

  const runViewStatusAction = useCallback(
    async (view: SavedView, action: 'archive' | 'restore') => {
      setPendingId(view.id);
      setError(null);
      try {
        if (action === 'archive') {
          await archiveSavedView(view.id);
        } else {
          await restoreSavedView(view.id);
        }
        emitSavedViewsChanged();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to ${action}`);
      } finally {
        setPendingId(null);
      }
    },
    [router]
  );

  const handleArchive = useCallback(
    (view: SavedView) => runViewStatusAction(view, 'archive'),
    [runViewStatusAction]
  );

  const handleRestore = useCallback(
    (view: SavedView) => runViewStatusAction(view, 'restore'),
    [runViewStatusAction]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!viewToDelete) {
      return;
    }
    setDeletePending(true);
    setError(null);
    try {
      if (viewToDelete.kind === 'share') {
        await deleteSharedView(viewToDelete.view.id);
      } else {
        await deleteSavedView(viewToDelete.view.id);
      }
      emitSavedViewsChanged();
      setViewToDelete(null);
      router.refresh();
    } catch (err) {
      let error: string;
      if (err instanceof Error) {
        error = err.message;
      } else if (viewToDelete.kind === 'share') {
        error = 'Failed to remove shared view';
      } else {
        error = 'Failed to delete saved view';
      }

      setError(error);
    } finally {
      setDeletePending(false);
    }
  }, [router, viewToDelete]);

  const columns = useMemo(
    () =>
      createViewsTableColumns({
        tab,
        pendingId,
        onShare: (view) => {
          setShareView(view);
          setShareDialogOpen(true);
        },
        onArchive: (view) => void handleArchive(view),
        onRestore: (view) => void handleRestore(view),
        onRequestDelete: setViewToDelete,
      }),
    [handleArchive, handleRestore, pendingId, tab]
  );
  const table = useReactTable({
    data: views,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <div className="space-y-6">
      <DismissibleError message={error} onDismiss={() => setError(null)} />

      <Card className="border-border bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Layers className="text-primary size-5" />
            Views
          </CardTitle>
          <CardDescription>
            Manage saved page snapshots, share them with teammates, and archive
            ones you no longer need.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={searchQuery}
              onValueChange={setSearchQuery}
              onClear={handleClearSearch}
              placeholder="Search views..."
            />

            <div className="flex flex-wrap gap-2">
              {TABS.map(({ id, label }) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={tab === id ? 'secondary' : 'ghost'}
                  className={cn('h-8', tab === id && 'bg-secondary')}
                  aria-pressed={tab === id}
                  onClick={() => handleTabChange(id)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <ViewsColumnsDialog
              visibility={columnVisibility}
              disabled={!columnsHydrated}
              onApply={handleApplyColumnVisibility}
            />

            {hasActiveSearch ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSearch}
                className="text-muted-foreground hover:text-foreground h-9 cursor-pointer px-3 text-xs"
              >
                Clear search
                <X className="size-3.5" />
              </Button>
            ) : null}
          </div>

          <DataTable
            table={table}
            columnCount={table.getVisibleLeafColumns().length}
            emptyState={
              <p className="text-muted-foreground text-sm">
                {emptyViewsMessage(tab)}
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
            label="views"
          />
        </CardContent>
      </Card>

      <ShareViewDialog
        view={shareView}
        open={shareDialogOpen}
        projects={shareProjects}
        onOpenChange={(open) => {
          setShareDialogOpen(open);
          if (!open) {
            afterDialogClose(() => {
              setShareView(null);
            });
          }
        }}
      />

      {viewToDelete ? (
        <RegistryConfirmDialog
          title={
            viewToDelete.kind === 'share'
              ? 'Remove shared view'
              : 'Permanently delete view'
          }
          subject={viewToDelete.view.title}
          detail={
            viewToDelete.kind === 'share'
              ? 'This removes the view from Shared with me only. The owner’s copy is unchanged, and they can share it with you again later.'
              : 'This action is irreversible. The saved view and any share records linked to it will be permanently removed from the database.'
          }
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={deletePending}
          isSoft={false}
          onCancel={() => setViewToDelete(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}
    </div>
  );
}
