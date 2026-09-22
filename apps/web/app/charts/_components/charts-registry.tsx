'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
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
  Trash2,
  UserRound,
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
import { afterDialogClose } from '@/lib/dialog-close';
import { isSessionExpiredError } from '@/lib/errors/session-expired';
import { ChartsSaveWorkspaceDialog } from '@/app/charts/_components/charts-save-workspace-dialog';
import { ChartsWorkspaceEmptyPanel } from '@/app/charts/_components/charts-workspace-empty-panel';
import type { ChartWorkspaceRecord } from '@/app/charts/_components/charts.types';
import { chartsWorkspaceHref } from '@/app/charts/_helpers/charts-links';
import {
  clearLegacyChartsLocalStorage,
  suggestChartWorkspaceTitle,
} from '@/app/charts/_helpers/charts-workspace-utils';
import { useChartsRegistryUrlActions } from '@/app/charts/_hooks/use-charts-registry-shallow-params';
import type { ChartsRegistryListTab } from '@/lib/search-params';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import {
  archiveChartWorkspace,
  createChartWorkspaceOnApi,
  deleteChartWorkspace,
  restoreChartWorkspace,
} from '@/app/charts/_services/charts.mutations.client';
import {
  chartOwnershipForViewer,
  chartWorkspaceFromApiRow,
} from '@/app/charts/_helpers/charts-workspace-map';

const TABS: ReadonlyArray<{
  id: ChartsRegistryListTab;
  label: string;
  icon: typeof UserRound;
}> = [
  { id: 'mine', label: 'Active', icon: UserRound },
  { id: 'archived', label: 'Archived', icon: Archive },
];

const DEFAULT_LIMIT = 10;

/** Stable empty rows for TanStack Table (inline `[]` re-renders forever). */
const EMPTY_CHART_ROWS: ChartWorkspaceRecord[] = [];

type DeleteTarget = {
  readonly kind: 'owned';
  readonly workspace: ChartWorkspaceRecord;
};

type ChartsRegistryProps = {
  readonly currentUserId: string;
  readonly initialWorkspaces: readonly ChartWorkspaceRecord[];
  readonly tab: ChartsRegistryListTab;
  readonly page: number;
  readonly limit: number;
  readonly search: string;
};

function emptyChartsMessage(tab: ChartsRegistryListTab): string {
  if (tab === 'archived') {
    return 'No archived workspaces.';
  }
  return 'No workspaces yet.';
}

function filterWorkspacesForTab(
  workspaces: readonly ChartWorkspaceRecord[],
  tab: ChartsRegistryListTab,
  search: string
): ChartWorkspaceRecord[] {
  const query = search.trim().toLowerCase();
  return workspaces.filter((workspace) => {
    const ownership = workspace.ownership ?? 'mine';
    if (ownership !== 'mine') {
      return false;
    }
    if (tab === 'mine' && workspace.status !== 'active') {
      return false;
    }
    if (tab === 'archived' && workspace.status !== 'archived') {
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
  readonly tab: ChartsRegistryListTab;
  readonly pendingId: string | null;
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
            afterDialogClose(() =>
              onRequestDelete({ kind: 'owned', workspace })
            );
          }}
        >
          <Trash2 className="size-4" />
          Delete
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
  // eslint-disable-next-line no-unused-vars -- setter
  readonly setError: (message: string | null) => void;
  // eslint-disable-next-line no-unused-vars -- setter
  readonly setPendingId: (id: string | null) => void;
  readonly setWorkspaces: Dispatch<SetStateAction<ChartWorkspaceRecord[]>>;
}) {
  const { currentUserId, setError, setPendingId, setWorkspaces } = params;
  const deleteInFlightRef = useRef(false);

  const runStatusAction = useCallback(
    async (workspace: ChartWorkspaceRecord, action: 'archive' | 'restore') => {
      setPendingId(workspace.id);
      setError(null);
      try {
        const row =
          action === 'archive'
            ? await archiveChartWorkspace(workspace.id)
            : await restoreChartWorkspace(workspace.id);
        const next = chartWorkspaceFromApiRow(
          row,
          chartOwnershipForViewer(row, currentUserId)
        );
        setWorkspaces((previous) =>
          previous.map((item) => (item.id === next.id ? next : item))
        );
      } catch (err) {
        if (isSessionExpiredError(err)) {
          return;
        }
        setError(err instanceof Error ? err.message : `Failed to ${action}`);
      } finally {
        setPendingId(null);
      }
    },
    [currentUserId, setError, setPendingId, setWorkspaces]
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
        await deleteChartWorkspace(target.workspace.id);
      } catch (err) {
        if (isSessionExpiredError(err)) {
          return;
        }
        setWorkspaces((previous) => [...previous, target.workspace]);
        setError(
          err instanceof Error ? err.message : 'Failed to delete workspace'
        );
      } finally {
        deleteInFlightRef.current = false;
      }
    },
    [setError, setWorkspaces]
  );

  return { runStatusAction, handleConfirmDelete };
}

export function ChartsRegistry({
  currentUserId,
  initialWorkspaces,
  tab,
  page,
  limit,
  search,
}: Readonly<ChartsRegistryProps>) {
  const router = useRouter();
  const { setTab } = useChartsRegistryUrlActions(DEFAULT_LIMIT);

  const [workspaces, setWorkspaces] = useState<ChartWorkspaceRecord[]>(() => [
    ...initialWorkspaces,
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const resolvedLimit = limit > 0 ? limit : DEFAULT_LIMIT;

  useEffect(() => {
    clearLegacyChartsLocalStorage(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    setWorkspaces([...initialWorkspaces]);
  }, [initialWorkspaces]);

  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);
  const filtered = useMemo(
    () => filterWorkspacesForTab(workspaces, tab, searchQuery),
    [searchQuery, tab, workspaces]
  );

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / resolvedLimit) || 1);
  const { handlePageChange, handleLimitChange } = usePaginationNavigation(
    totalPages,
    resolvedLimit
  );
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pageItems = useMemo(() => {
    if (filtered.length === 0) {
      return EMPTY_CHART_ROWS;
    }
    return filtered.slice(
      (safePage - 1) * resolvedLimit,
      safePage * resolvedLimit
    );
  }, [filtered, resolvedLimit, safePage]);

  const { runStatusAction, handleConfirmDelete } = useChartsRegistryMutations({
    currentUserId,
    setError,
    setPendingId,
    setWorkspaces,
  });

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  const createDefaultTitle = useMemo(
    () =>
      suggestChartWorkspaceTitle(
        workspaces.map((workspace) => workspace.title)
      ),
    [workspaces]
  );

  const handleCreate = useCallback(
    async (payload: { title: string; isOverview: boolean }) => {
      setError(null);
      try {
        const created = await createChartWorkspaceOnApi({
          title: payload.title,
          isOverview: payload.isOverview,
          viewerId: currentUserId,
        });
        setWorkspaces((previous) => [created, ...previous]);
        router.push(chartsWorkspaceHref(created.id));
      } catch (err) {
        if (isSessionExpiredError(err)) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Failed to create workspace';
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [currentUserId, router]
  );

  const columns = useMemo(
    () =>
      createChartsTableColumns({
        tab,
        pendingId,
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

  // Stable row-model + memoized `data` — TanStack Table auto-resets page index
  // when `data` identity changes; a fresh `.slice()` each render freezes the tab.
  const [coreRowModel] = useState(() => getCoreRowModel());

  const table = useReactTable({
    data: pageItems,
    columns,
    getCoreRowModel: coreRowModel,
    autoResetPageIndex: false,
    manualPagination: true,
  });

  const showEmptyCreate =
    tab === 'mine' && totalCount === 0 && !searchQuery.trim();
  const hasActiveSearch = Boolean(searchQuery.trim());

  return (
    <ChartsRegistryLoadedView
      error={error}
      onDismissError={() => setError(null)}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      onClearSearch={handleClearSearch}
      tab={tab}
      onTabChange={setTab}
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
  readonly tab: ChartsRegistryListTab;
  // eslint-disable-next-line no-unused-vars -- tab change
  readonly onTabChange: (tab: ChartsRegistryListTab) => void;
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
        <div className="flex flex-wrap items-center gap-2 self-start">
          <RegistryTabSwitcher
            tabs={TABS}
            value={props.tab}
            onChange={props.onTabChange}
            aria-label="Workspace list filter"
          />
          <Button
            type="button"
            className="cursor-pointer gap-2"
            onClick={props.onOpenCreate}
          >
            <Plus className="size-4" data-icon="inline-start" />
            Create Workspace
          </Button>
        </div>
      </div>

      <Card className="border-border bg-card/50 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden backdrop-blur-md">
        <CardHeader className="shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="text-primary size-5 shrink-0" />
            Charts
          </CardTitle>
          <CardDescription>
            Manage your chart workspaces and open a board to arrange widgets.
            Share boards via Save view in the header, then share from Views.
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
      {props.deleteTarget ? (
        <RegistryConfirmDialog
          title="Permanently delete workspace"
          subject={props.deleteTarget.workspace.title}
          detail="This action is irreversible. The chart workspace and its board layout will be permanently removed."
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={props.deletePending}
          isSoft={false}
          onCancel={props.onCancelDelete}
          onConfirm={props.onConfirmDelete}
        />
      ) : null}
    </div>
  );
}
