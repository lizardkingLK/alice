'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  Archive,
  BarChart3,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  UserRound,
  Users,
  X,
} from '@repo/ui/lib/icons';
import { DataTable } from '@/components/data-table';
import { DismissibleError } from '@/components/dismissible-error';
import { Pagination } from '@/components/pagination';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import { RegistryTabSwitcher } from '@/components/registry-tab-switcher';
import { RegistryTitleCell } from '@/components/registry-title-cell';
import { SearchInput } from '@/components/search-input';
import { formatDate, formatDateTime } from '@/app/_shared/utility';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { afterDialogClose } from '@/lib/dialog-close';
import { isSessionExpiredError } from '@/lib/errors/session-expired';
import type { ViewsListTab } from '@/lib/search-params';
import { ChartsSaveWorkspaceDialog } from '@/app/charts/_components/charts-save-workspace-dialog';
import { ChartsShareWorkspaceDialog } from '@/app/charts/_components/charts-share-workspace-dialog';
import { ChartsWorkspaceEmptyPanel } from '@/app/charts/_components/charts-workspace-empty-panel';
import { ChartsRegistrySkeleton } from '@/app/charts/_components/charts-workspace-skeleton';
import type { ChartWorkspaceRecord } from '@/app/charts/_components/charts.types';
import { chartsWorkspaceHref } from '@/app/charts/_helpers/charts-links';
import { hydrateChartWorkspacesFromApi } from '@/app/charts/_helpers/charts-workspace-hydrate';
import {
  createChartWorkspace,
  listChartWorkspaces,
  removeChartWorkspace,
  renameChartWorkspaceMeta,
  suggestChartWorkspaceTitle,
  upsertChartWorkspace,
} from '@/app/charts/_helpers/charts-workspace-storage';
import {
  archiveChartWorkspace,
  deleteChartWorkspace,
  leaveSharedChartWorkspace,
  restoreChartWorkspace,
  syncChartWorkspaceToApi,
} from '@/app/charts/_services/charts.mutations.client';

const TABS: ReadonlyArray<{
  id: ViewsListTab;
  label: string;
  icon: typeof UserRound;
}> = [
  { id: 'mine', label: 'My workspaces', icon: UserRound },
  { id: 'shared', label: 'Shared with me', icon: Users },
  { id: 'archived', label: 'Archived', icon: Archive },
];

const DEFAULT_LIMIT = 10;

type DeleteTarget =
  | { readonly kind: 'owned'; readonly workspace: ChartWorkspaceRecord }
  | { readonly kind: 'share'; readonly workspace: ChartWorkspaceRecord };

type ChartsRegistryProps = {
  readonly currentUserId: string;
  readonly tab: ViewsListTab;
  readonly search: string;
  readonly page: number;
  readonly limit: number;
  readonly shareProjects: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
};

function emptyChartsMessage(tab: ViewsListTab): string {
  if (tab === 'shared') {
    return 'No chart workspaces have been shared with you yet.';
  }
  if (tab === 'archived') {
    return 'No archived workspaces.';
  }
  return 'No workspaces yet.';
}

function filterWorkspacesForTab(
  workspaces: readonly ChartWorkspaceRecord[],
  tab: ViewsListTab,
  search: string
): ChartWorkspaceRecord[] {
  const query = search.trim().toLowerCase();
  return workspaces.filter((workspace) => {
    const ownership = workspace.ownership ?? 'mine';
    if (tab === 'mine') {
      if (ownership !== 'mine' || workspace.status !== 'active') {
        return false;
      }
    } else if (tab === 'shared') {
      if (ownership !== 'shared' || workspace.status !== 'active') {
        return false;
      }
    } else if (ownership !== 'mine' || workspace.status !== 'archived') {
      return false;
    }
    return !query || workspace.title.toLowerCase().includes(query);
  });
}

function ChartsTitleCell({
  workspace,
}: Readonly<{ workspace: ChartWorkspaceRecord }>) {
  return (
    <RegistryTitleCell
      href={chartsWorkspaceHref(workspace.id)}
      title={workspace.title}
      subtitle={`Updated ${formatDate(workspace.updatedAt)}`}
    />
  );
}

function ChartsOverviewCell({
  workspace,
}: Readonly<{ workspace: ChartWorkspaceRecord }>) {
  if (!workspace.isOverview) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <Badge variant="secondary">Overview</Badge>;
}

function ChartsUpdatedAtCell({
  workspace,
}: Readonly<{ workspace: ChartWorkspaceRecord }>) {
  return (
    <span className="text-muted-foreground">
      {formatDateTime(workspace.updatedAt)}
    </span>
  );
}

type ChartsActionsCellProps = {
  readonly workspace: ChartWorkspaceRecord;
  readonly tab: ViewsListTab;
  readonly pendingId: string | null;
  // eslint-disable-next-line no-unused-vars -- share open callback
  readonly onShare: (workspace: ChartWorkspaceRecord) => void;
  // eslint-disable-next-line no-unused-vars -- archive callback
  readonly onArchive: (workspace: ChartWorkspaceRecord) => void;
  // eslint-disable-next-line no-unused-vars -- restore callback
  readonly onRestore: (workspace: ChartWorkspaceRecord) => void;
  // eslint-disable-next-line no-unused-vars -- delete target callback
  readonly onRequestDelete: (target: DeleteTarget) => void;
};

function ChartsActionsCell({
  workspace,
  tab,
  pendingId,
  onShare,
  onArchive,
  onRestore,
  onRequestDelete,
}: Readonly<ChartsActionsCellProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={pendingId === workspace.id}
          aria-label="Open row actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {tab === 'mine' ? (
          <DropdownMenuItem
            onSelect={() => {
              afterDialogClose(() => onShare(workspace));
            }}
          >
            <Share2 className="size-4" />
            Share
          </DropdownMenuItem>
        ) : null}
        {tab === 'mine' ? (
          <DropdownMenuItem onSelect={() => onArchive(workspace)}>
            <Archive className="size-4" />
            Archive
          </DropdownMenuItem>
        ) : null}
        {tab === 'archived' ? (
          <DropdownMenuItem onSelect={() => onRestore(workspace)}>
            <RefreshCw className="size-4" />
            Restore
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-rose-600 focus:text-rose-600"
          onSelect={() => {
            // Wait for Radix menu scroll-lock / pointer-events to clear,
            // otherwise the confirm overlay can trap an inert page.
            afterDialogClose(() =>
              onRequestDelete({
                kind: tab === 'shared' ? 'share' : 'owned',
                workspace,
              })
            );
          }}
        >
          <Trash2 className="size-4" />
          {tab === 'shared' ? 'Leave' : 'Delete'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type ChartsTableColumnsOptions = Omit<ChartsActionsCellProps, 'workspace'>;

function createChartsTableColumns(
  options: ChartsTableColumnsOptions
): ColumnDef<ChartWorkspaceRecord>[] {
  function renderTitle({
    row,
  }: {
    readonly row: { readonly original: ChartWorkspaceRecord };
  }) {
    return <ChartsTitleCell workspace={row.original} />;
  }
  function renderOverview({
    row,
  }: {
    readonly row: { readonly original: ChartWorkspaceRecord };
  }) {
    return <ChartsOverviewCell workspace={row.original} />;
  }
  function renderUpdated({
    row,
  }: {
    readonly row: { readonly original: ChartWorkspaceRecord };
  }) {
    return <ChartsUpdatedAtCell workspace={row.original} />;
  }
  function renderActions({
    row,
  }: {
    readonly row: { readonly original: ChartWorkspaceRecord };
  }) {
    return <ChartsActionsCell workspace={row.original} {...options} />;
  }

  return [
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Title',
      cell: renderTitle,
    },
    {
      id: 'overview',
      header: 'Overview',
      cell: renderOverview,
    },
    {
      id: 'updated_at',
      accessorKey: 'updatedAt',
      header: 'Updated',
      cell: renderUpdated,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: renderActions,
    },
  ];
}

function useChartsRegistryMutations(params: {
  readonly currentUserId: string;
  readonly refreshList: () => void;
  // eslint-disable-next-line no-unused-vars -- setter
  readonly setError: (message: string | null) => void;
  // eslint-disable-next-line no-unused-vars -- setter
  readonly setPendingId: (id: string | null) => void;
  readonly setWorkspaces: Dispatch<SetStateAction<ChartWorkspaceRecord[]>>;
}) {
  const { currentUserId, refreshList, setError, setPendingId, setWorkspaces } =
    params;
  const deleteInFlightRef = useRef(false);

  const runStatusAction = useCallback(
    async (workspace: ChartWorkspaceRecord, action: 'archive' | 'restore') => {
      setPendingId(workspace.id);
      setError(null);
      try {
        if (action === 'archive') {
          await archiveChartWorkspace(workspace.id);
          renameChartWorkspaceMeta(currentUserId, workspace.id, {
            status: 'archived',
            isOverview: false,
          });
        } else {
          await restoreChartWorkspace(workspace.id);
          renameChartWorkspaceMeta(currentUserId, workspace.id, {
            status: 'active',
          });
        }
        refreshList();
      } catch (err) {
        if (isSessionExpiredError(err)) {
          return;
        }
        setError(err instanceof Error ? err.message : `Failed to ${action}`);
      } finally {
        setPendingId(null);
      }
    },
    [currentUserId, refreshList, setError, setPendingId]
  );

  const handleConfirmDelete = useCallback(
    async (deleteTarget: DeleteTarget | null) => {
      if (!deleteTarget || deleteInFlightRef.current) {
        return;
      }
      deleteInFlightRef.current = true;
      const target = deleteTarget;
      setError(null);
      setWorkspaces((previous) =>
        previous.filter((workspace) => workspace.id !== target.workspace.id)
      );

      try {
        if (target.kind === 'share') {
          await leaveSharedChartWorkspace(target.workspace.id);
        } else {
          await deleteChartWorkspace(target.workspace.id);
        }
        removeChartWorkspace(currentUserId, target.workspace.id);
      } catch (err) {
        if (isSessionExpiredError(err)) {
          return;
        }
        upsertChartWorkspace(currentUserId, target.workspace);
        refreshList();
        let message = 'Failed to delete workspace';
        if (err instanceof Error) {
          message = err.message;
        } else if (target.kind === 'share') {
          message = 'Failed to leave shared workspace';
        }
        setError(message);
      } finally {
        deleteInFlightRef.current = false;
      }
    },
    [currentUserId, refreshList, setError, setWorkspaces]
  );

  return { runStatusAction, handleConfirmDelete };
}

function useChartsRegistryHydrate(
  currentUserId: string,
  refreshList: () => void
): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        await hydrateChartWorkspacesFromApi(currentUserId);
      } catch {
        // Local cache may still render.
      }
      if (cancelled) {
        return;
      }
      refreshList();
      setHydrated(true);
    }

    hydrate().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUserId, refreshList]);

  return hydrated;
}

function applyRegistryTabParam(
  params: URLSearchParams,
  nextTab: ViewsListTab
): void {
  if (nextTab === 'mine') {
    params.delete('tab');
    return;
  }
  params.set('tab', nextTab);
}

export function ChartsRegistry({
  currentUserId,
  tab,
  search,
  page,
  limit,
  shareProjects,
}: Readonly<ChartsRegistryProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [workspaces, setWorkspaces] = useState<ChartWorkspaceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareWorkspace, setShareWorkspace] =
    useState<ChartWorkspaceRecord | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);
  const resolvedLimit = limit > 0 ? limit : DEFAULT_LIMIT;

  const refreshList = useCallback(() => {
    setWorkspaces(listChartWorkspaces(currentUserId));
  }, [currentUserId]);

  const hydrated = useChartsRegistryHydrate(currentUserId, refreshList);

  const { runStatusAction, handleConfirmDelete } = useChartsRegistryMutations({
    currentUserId,
    refreshList,
    setError,
    setPendingId,
    setWorkspaces,
  });

  const filtered = useMemo(
    () => filterWorkspacesForTab(workspaces, tab, searchQuery),
    [searchQuery, tab, workspaces]
  );

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / resolvedLimit) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * resolvedLimit,
    safePage * resolvedLimit
  );

  const { handlePageChange, handleLimitChange } = usePaginationNavigation(
    totalPages,
    resolvedLimit
  );

  const handleTabChange = useCallback(
    (nextTab: ViewsListTab) => {
      const params = new URLSearchParams(searchParams.toString());
      applyRegistryTabParam(params, nextTab);
      params.set('page', '1');
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  const createDefaultTitle = useMemo(
    () => suggestChartWorkspaceTitle(currentUserId),
    [currentUserId]
  );

  const handleCreate = useCallback(
    async (payload: { title: string; isOverview: boolean }) => {
      const created = createChartWorkspace(currentUserId, {
        title: payload.title,
        isOverview: payload.isOverview,
      });
      try {
        await syncChartWorkspaceToApi(created);
      } catch (err) {
        if (isSessionExpiredError(err)) {
          return;
        }
      }
      router.push(chartsWorkspaceHref(created.id));
    },
    [currentUserId, router]
  );

  const columns = useMemo(
    () =>
      createChartsTableColumns({
        tab,
        pendingId,
        onShare: (workspace) => {
          setShareWorkspace(workspace);
          setShareOpen(true);
        },
        onArchive: (workspace) => {
          runStatusAction(workspace, 'archive').catch(() => {});
        },
        onRestore: (workspace) => {
          runStatusAction(workspace, 'restore').catch(() => {});
        },
        onRequestDelete: setDeleteTarget,
      }),
    [pendingId, runStatusAction, tab]
  );

  const table = useReactTable({
    data: pageItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const showEmptyCreate = tab === 'mine' && hydrated && totalCount === 0;
  const hasActiveSearch = Boolean(search.trim());

  if (!hydrated) {
    return <ChartsRegistrySkeleton />;
  }

  return (
    <ChartsRegistryLoadedView
      error={error}
      onDismissError={() => setError(null)}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      onClearSearch={handleClearSearch}
      tab={tab}
      onTabChange={handleTabChange}
      hasActiveSearch={hasActiveSearch}
      onOpenCreate={() => setCreateOpen(true)}
      showEmptyCreate={showEmptyCreate}
      table={table}
      emptyMessage={emptyChartsMessage(tab)}
      totalCount={totalCount}
      safePage={safePage}
      resolvedLimit={resolvedLimit}
      totalPages={totalPages}
      onPageChange={handlePageChange}
      onLimitChange={handleLimitChange}
      createOpen={createOpen}
      onCreateOpenChange={setCreateOpen}
      createDefaultTitle={createDefaultTitle}
      onCreate={handleCreate}
      shareOpen={shareOpen}
      onShareOpenChange={(open) => {
        setShareOpen(open);
        if (!open) {
          afterDialogClose(() => {
            setShareWorkspace(null);
          });
        }
      }}
      shareWorkspace={shareWorkspace}
      shareProjects={shareProjects}
      currentUserId={currentUserId}
      deleteTarget={deleteTarget}
      deletePending={deletePending}
      onCancelDelete={() => setDeleteTarget(null)}
      onConfirmDelete={() => {
        const target = deleteTarget;
        setDeleteTarget(null);
        setDeletePending(false);
        handleConfirmDelete(target).catch(() => {});
      }}
    />
  );
}

function ChartsRegistryLoadedView(props: {
  readonly error: string | null;
  readonly onDismissError: () => void;
  readonly searchQuery: string;
  // eslint-disable-next-line no-unused-vars -- search change
  readonly onSearchQueryChange: (value: string) => void;
  readonly onClearSearch: () => void;
  readonly tab: ViewsListTab;
  // eslint-disable-next-line no-unused-vars -- tab change
  readonly onTabChange: (tab: ViewsListTab) => void;
  readonly hasActiveSearch: boolean;
  readonly onOpenCreate: () => void;
  readonly showEmptyCreate: boolean;
  readonly table: ReturnType<typeof useReactTable<ChartWorkspaceRecord>>;
  readonly emptyMessage: string;
  readonly totalCount: number;
  readonly safePage: number;
  readonly resolvedLimit: number;
  readonly totalPages: number;
  // eslint-disable-next-line no-unused-vars -- page change
  readonly onPageChange: (page: number) => void;
  // eslint-disable-next-line no-unused-vars -- limit change
  readonly onLimitChange: (limit: number) => void;
  readonly createOpen: boolean;
  // eslint-disable-next-line no-unused-vars -- create dialog
  readonly onCreateOpenChange: (open: boolean) => void;
  readonly createDefaultTitle: string;
  readonly onCreate: (
    // eslint-disable-next-line no-unused-vars -- create payload
    payload: { title: string; isOverview: boolean }
  ) => Promise<void>;
  readonly shareOpen: boolean;
  // eslint-disable-next-line no-unused-vars -- share dialog
  readonly onShareOpenChange: (open: boolean) => void;
  readonly shareWorkspace: ChartWorkspaceRecord | null;
  readonly shareProjects: ChartsRegistryProps['shareProjects'];
  readonly currentUserId: string;
  readonly deleteTarget: DeleteTarget | null;
  readonly deletePending: boolean;
  readonly onCancelDelete: () => void;
  readonly onConfirmDelete: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
      {props.error ? (
        <DismissibleError
          message={props.error}
          onDismiss={props.onDismissError}
        />
      ) : null}

      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={props.searchQuery}
            onValueChange={props.onSearchQueryChange}
            onClear={props.onClearSearch}
            placeholder="Search workspaces…"
          />
          <RegistryTabSwitcher
            tabs={TABS}
            value={props.tab}
            onChange={props.onTabChange}
            aria-label="Workspace list filter"
          />
          {props.hasActiveSearch ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={props.onClearSearch}
              className="text-muted-foreground hover:text-foreground h-9 cursor-pointer px-3 text-xs"
            >
              Clear search
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
        <Button
          type="button"
          className="cursor-pointer gap-2 self-start"
          onClick={props.onOpenCreate}
        >
          <Plus className="size-4" data-icon="inline-start" />
          Create Workspace
        </Button>
      </div>

      <Card className="border-border bg-card/50 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden backdrop-blur-md">
        <CardHeader className="shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="text-primary size-5 shrink-0" />
            Charts
          </CardTitle>
          <CardDescription>
            Manage chart workspaces, share them with teammates, and open a board
            to arrange widgets.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto pt-2 pb-4">
          {props.showEmptyCreate ? (
            <ChartsWorkspaceEmptyPanel onCreate={props.onOpenCreate} />
          ) : (
            <>
              <DataTable
                table={props.table}
                columnCount={props.table.getVisibleLeafColumns().length}
                emptyState={
                  <p className="text-muted-foreground text-sm">
                    {props.emptyMessage}
                  </p>
                }
              />
              <Pagination
                totalCount={props.totalCount}
                page={props.safePage}
                limit={props.resolvedLimit}
                totalPages={props.totalPages}
                onPageChange={props.onPageChange}
                onLimitChange={props.onLimitChange}
                label="workspaces"
              />
            </>
          )}
        </CardContent>
      </Card>

      <ChartsSaveWorkspaceDialog
        open={props.createOpen}
        onOpenChange={props.onCreateOpenChange}
        mode="create"
        defaultTitle={props.createDefaultTitle}
        initialIsOverview={false}
        onSave={props.onCreate}
      />
      <ChartsShareWorkspaceDialog
        open={props.shareOpen}
        onOpenChange={props.onShareOpenChange}
        workspace={props.shareWorkspace}
        projects={props.shareProjects}
        currentUserId={props.currentUserId}
      />
      {props.deleteTarget ? (
        <ChartsRegistryDeleteDialog
          target={props.deleteTarget}
          isPending={props.deletePending}
          onCancel={props.onCancelDelete}
          onConfirm={props.onConfirmDelete}
        />
      ) : null}
    </div>
  );
}

function ChartsRegistryDeleteDialog({
  target,
  isPending,
  onCancel,
  onConfirm,
}: Readonly<{
  target: DeleteTarget;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  const isShare = target.kind === 'share';
  return (
    <RegistryConfirmDialog
      title={
        isShare ? 'Leave shared workspace' : 'Permanently delete workspace'
      }
      subject={target.workspace.title}
      detail={
        isShare
          ? 'This removes the workspace from Shared with me only. The owner’s copy is unchanged, and they can share it with you again later.'
          : 'This action is irreversible. The chart workspace, its board layout, and any share records linked to it will be permanently removed. The matching Views bookmark is removed as well.'
      }
      confirmLabel={isShare ? 'Leave' : 'Delete'}
      pendingLabel={isShare ? 'Leaving...' : 'Deleting...'}
      isPending={isPending}
      isSoft={false}
      actionVerb={isShare ? 'leave' : undefined}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
