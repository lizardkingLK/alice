'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { ClipboardPenLine } from '@repo/ui/lib/icons';
import { WorkItemFormDialog } from '@/app/work-items/_components/work-item-form-dialog';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { WorkItemWorkspaceProps } from '@/app/work-items/_components/workItems-workspace';
import { useWorkItemHierarchy } from '@/app/work-items/_hooks/use-work-item-hierarchy';
import { buildWorkItemColumns } from '@/app/work-items/_components/workItems-table-columns';
import {
  applyWorkItemListViewParam,
  applyWorkItemsFilterDraftToSearchParams,
  buildClearedWorkItemFilterParams,
  buildWorkItemDisplayRows,
  hasActiveWorkItemFilters,
  resolveWorkItemsListDescription,
  type WorkItemsFilterDraft,
} from '@/app/work-items/_components/workItems-table-helpers';
import { WorkItemsTableToolbar } from '@/app/work-items/_components/workItems-table-toolbar';
import { WorkItemsSearchResultsPanel } from '@/app/work-items/_components/workItems-search-results-panel';
import type { DisplayRow } from '@/app/work-items/_components/workItems-table-types';
import {
  pickWorkspaceDefaultsDialogController,
  WorkspaceDefaultsDialogHost,
} from '@/app/board/_components/workspace-defaults-dialog-host';
import { useBoardDefaultsBootstrap } from '@/app/board/_hooks/use-board-defaults-bootstrap';
import {
  DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY,
  normalizeWorkItemTableColumnVisibility,
  readWorkItemTableColumnVisibility,
  writeWorkItemTableColumnVisibility,
} from '@/app/work-items/_helpers/work-item-table-columns-storage';
import { Pagination } from '@/components/pagination';
import { DataTable } from '@/components/data-table';
import { DismissibleError } from '@/components/dismissible-error';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { useQueryFilter } from '@/hooks/use-query-filter';
import { usePathname, useSearchParams } from 'next/navigation';
import { serializeWorkItemLabelsFilter } from '@repo/types';
import type { WorkItemListView } from '@/lib/search-params';

/** Match DialogContent `duration-200` so edit UI doesn't flash to create while closing. */
const DIALOG_CLOSE_MS = 200;

type WorkItemsTableProps = WorkItemWorkspaceProps;

export default function WorkItemsTable({
  projects,
  projectMembers,
  sprints = [],
  initialWorkItems,
  totalCount,
  page,
  limit,
  totalPages,
  search,
  projectFilter,
  sprintFilter = '',
  typeFilter,
  assigneeFilter,
  labelsFilter = [],
  listView = 'flat',
  lockedProjectId,
  lockedAssigneeId,
  currentUserId,
  suggestedDefaults = null,
  needsClientBootstrap = false,
  initialColumnVisibility,
  columnVisibilityHasCookie = true,
}: Readonly<WorkItemsTableProps>) {
  const { handlePageChange, handleLimitChange, router } =
    usePaginationNavigation(totalPages, limit);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);
  const projectQuery = useQueryFilter('project', projectFilter);
  const sprintQuery = useQueryFilter('sprint', sprintFilter);
  const typeQuery = useQueryFilter('type', typeFilter);
  const assigneeQuery = useQueryFilter('assignee', assigneeFilter);
  const labelsQuery = useQueryFilter(
    'labels',
    serializeWorkItemLabelsFilter(labelsFilter)
  );
  const { setValue: setProjectFilterValue, allValue: projectAllValue } =
    projectQuery;
  const { setValue: setSprintFilterValue } = sprintQuery;
  const isProjectLocked = Boolean(lockedProjectId);
  const isAssigneeLocked = Boolean(lockedAssigneeId);
  const isHierarchy = listView === 'hierarchy';
  // Prefer server cookie bootstrap so the first paint matches saved prefs.
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () =>
      normalizeWorkItemTableColumnVisibility({
        ...(initialColumnVisibility ??
          DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY),
        ...(lockedProjectId ? { project: false } : {}),
      })
  );
  // Cookie present → ready immediately. Missing cookie → migrate from LS once.
  // Suspense (`RegistryPageSkeleton`) covers the server wait; we do not blank
  // the table body for column hydration (that flash was effectively invisible).
  const [columnsHydrated, setColumnsHydrated] = useState(
    columnVisibilityHasCookie
  );

  useEffect(() => {
    if (columnVisibilityHasCookie) {
      // Cookie already drove SSR — mirror it into localStorage and stay ready.
      writeWorkItemTableColumnVisibility(currentUserId, columnVisibility);
      setColumnsHydrated(true);
      return;
    }

    const fromLs = normalizeWorkItemTableColumnVisibility({
      ...readWorkItemTableColumnVisibility(currentUserId),
      ...(isProjectLocked ? { project: false } : {}),
    });
    setColumnVisibility(fromLs);
    writeWorkItemTableColumnVisibility(currentUserId, fromLs);
    setColumnsHydrated(true);
    // Intentionally omit columnVisibility — bootstrap / identity only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot bootstrap
  }, [columnVisibilityHasCookie, currentUserId, isProjectLocked]);

  const handleApplyColumnVisibility = useCallback(
    (next: VisibilityState) => {
      const normalized = normalizeWorkItemTableColumnVisibility({
        ...next,
        ...(isProjectLocked ? { project: false } : {}),
      });
      setColumnVisibility(normalized);
      writeWorkItemTableColumnVisibility(currentUserId, normalized);
    },
    [currentUserId, isProjectLocked]
  );

  // Workspace defaults belong on /work-items (and board/backlog), not My Work
  // (/member) or project-embedded lists — bootstrap would rewrite the URL.
  const showWorkspaceDefaults =
    Boolean(currentUserId) && !isProjectLocked && !isAssigneeLocked;

  const boardDefaults = useBoardDefaultsBootstrap({
    userId: showWorkspaceDefaults ? (currentUserId ?? null) : null,
    basePath: '/work-items',
    needsClientBootstrap: showWorkspaceDefaults && needsClientBootstrap,
    projectFilter,
    sprintFilter,
    projects,
    sprints,
    suggestedDefaults,
  });
  const {
    savedDefaultsApplied,
    urlFiltersActive,
    openDefaultsDialog,
    resetUrlFilters,
  } = boardDefaults;

  const listDescription = resolveWorkItemsListDescription({
    isAssigneeLocked,
    isProjectLocked,
    isHierarchy,
  });

  const handleApplyFilters = useCallback(
    (draft: WorkItemsFilterDraft) => {
      setProjectFilterValue(draft.project);
      setSprintFilterValue(draft.sprint);
      typeQuery.setValue(draft.type);
      assigneeQuery.setValue(draft.assignee);
      labelsQuery.setValue(
        serializeWorkItemLabelsFilter([...draft.labels]) || labelsQuery.allValue
      );

      const params = new URLSearchParams(searchParams.toString());
      applyWorkItemsFilterDraftToSearchParams(params, draft, {
        allValue: projectAllValue,
        isProjectLocked,
        isAssigneeLocked,
        listView,
      });
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [
      assigneeQuery,
      isAssigneeLocked,
      isProjectLocked,
      labelsQuery,
      listView,
      pathname,
      projectAllValue,
      router,
      searchParams,
      setProjectFilterValue,
      setSprintFilterValue,
      typeQuery,
    ]
  );

  const setListView = useCallback(
    (nextView: WorkItemListView) => {
      const params = new URLSearchParams(searchParams.toString());
      applyWorkItemListViewParam(params, nextView);
      params.set('page', '1');
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const hasActiveFilters = hasActiveWorkItemFilters({
    searchParams,
    isProjectLocked,
    isAssigneeLocked,
    showWorkspaceDefaults,
    urlFiltersActive,
  });

  const handleClearFilters = () => {
    setSearchQuery('');
    setProjectFilterValue(projectAllValue);
    setSprintFilterValue(sprintQuery.allValue);
    typeQuery.setValue(typeQuery.allValue);
    assigneeQuery.setValue(assigneeQuery.allValue);
    labelsQuery.setValue(labelsQuery.allValue);
    if (showWorkspaceDefaults) {
      resetUrlFilters();
      return;
    }
    const next = buildClearedWorkItemFilterParams({
      searchParams,
      listView,
      lockedProjectId: isProjectLocked ? lockedProjectId : undefined,
      lockedAssigneeId: isAssigneeLocked ? lockedAssigneeId : undefined,
    });
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has('search')) {
      return;
    }
    params.delete('search');
    params.set('page', '1');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams, setSearchQuery]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<DbWorkItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clearEditTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const reportHierarchyError = useCallback((message: string) => {
    setError(message);
  }, []);

  const {
    expandedIds,
    childrenByParentId,
    loadingIds,
    toggleExpand: handleToggleExpand,
  } = useWorkItemHierarchy({
    enabled: isHierarchy,
    roots: initialWorkItems,
    onError: reportHierarchyError,
  });

  const isEditMode = itemToEdit !== null;

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

  const displayRows = useMemo<DisplayRow[]>(
    () =>
      buildWorkItemDisplayRows({
        isHierarchy,
        roots: initialWorkItems,
        childrenByParentId,
        expandedIds,
        loadingIds,
      }),
    [childrenByParentId, expandedIds, initialWorkItems, isHierarchy, loadingIds]
  );

  const columns = useMemo(
    () =>
      buildWorkItemColumns({
        lockedProjectId,
        lockedAssigneeId,
        isHierarchy,
        currentUserId,
        projects,
        sprints,
        onToggleExpand: handleToggleExpand,
        openEditDialog,
      }),
    [
      currentUserId,
      handleToggleExpand,
      isHierarchy,
      lockedAssigneeId,
      lockedProjectId,
      openEditDialog,
      projects,
      sprints,
    ]
  );

  const table = useReactTable({
    data: displayRows,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.workItem.id,
  });

  return (
    <div className="space-y-6">
      <DismissibleError message={error} onDismiss={() => setError(null)} />

      <WorkItemsTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={handleClearSearch}
        isProjectLocked={isProjectLocked}
        isAssigneeLocked={isAssigneeLocked}
        isHierarchy={isHierarchy}
        projects={projects}
        projectMembers={projectMembers}
        sprints={sprints}
        projectQuery={projectQuery}
        sprintQuery={sprintQuery}
        typeQuery={typeQuery}
        assigneeQuery={assigneeQuery}
        labelsQuery={labelsQuery}
        onApplyFilters={handleApplyFilters}
        onListViewChange={setListView}
        columnVisibility={columnVisibility}
        onApplyColumnVisibility={handleApplyColumnVisibility}
        columnsHydrated={columnsHydrated}
        showWorkspaceDefaults={showWorkspaceDefaults}
        onOpenDefaultsDialog={openDefaultsDialog}
        savedDefaultsApplied={savedDefaultsApplied}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        onCreate={openCreateDialog}
      />

      <WorkItemsSearchResultsPanel search={search} items={initialWorkItems} />

      <Card className="border-border bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardPenLine className="text-primary size-5" />
            Work Items
          </CardTitle>
          <CardDescription>{listDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            table={table}
            columnCount={table.getVisibleLeafColumns().length}
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

      <WorkItemFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        title={isEditMode ? 'Edit Work Item' : 'Create Work Item'}
        description={
          isEditMode
            ? 'Update the details for this work item.'
            : 'Add a new work item and assign it to a team member.'
        }
        projects={projects}
        itemToEdit={itemToEdit}
        projectMembers={projectMembers}
        lockProject={isProjectLocked}
        lockAssigneeId={lockedAssigneeId}
        onClose={() => handleDialogChange(false)}
        onSuccess={() => handleUpdated()}
      />

      <WorkspaceDefaultsDialogHost
        enabled={showWorkspaceDefaults}
        projects={projects}
        sprints={sprints}
        defaults={pickWorkspaceDefaultsDialogController(boardDefaults)}
      />
    </div>
  );
}
