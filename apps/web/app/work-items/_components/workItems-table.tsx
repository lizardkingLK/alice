'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
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
  buildClearedWorkItemFilterParams,
  buildWorkItemDisplayRows,
  hasActiveWorkItemFilters,
  resolveWorkItemsListDescription,
} from '@/app/work-items/_components/workItems-table-helpers';
import { WorkItemsTableToolbar } from '@/app/work-items/_components/workItems-table-toolbar';
import type { DisplayRow } from '@/app/work-items/_components/workItems-table-types';
import {
  applyProjectFilterToSearchParams,
  buildSprintFilterOptions,
} from '@/app/board/_services/board-defaults';
import { BoardDefaultsDialog } from '@/app/board/_components/board-defaults-dialog';
import { useBoardDefaultsBootstrap } from '@/app/board/_hooks/use-board-defaults-bootstrap';
import { Pagination } from '@/components/pagination';
import { DataTable } from '@/components/data-table';
import { DismissibleError } from '@/components/dismissible-error';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { useQueryFilter } from '@/hooks/use-query-filter';
import { usePathname, useSearchParams } from 'next/navigation';
import type { WorkItemListView } from '@/lib/search-params';

export type { RendererProps } from '@/app/work-items/_components/workItems-table-types';

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
  listView = 'flat',
  lockedProjectId,
  lockedAssigneeId,
  currentUserId,
  suggestedDefaults = null,
  needsClientBootstrap = false,
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
  const isProjectLocked = Boolean(lockedProjectId);
  const isAssigneeLocked = Boolean(lockedAssigneeId);
  const isHierarchy = listView === 'hierarchy';
  // Workspace defaults belong on /work-items (and board/backlog), not My Work
  // (/member) or project-embedded lists — bootstrap would rewrite the URL.
  const showWorkspaceDefaults =
    Boolean(currentUserId) && !isProjectLocked && !isAssigneeLocked;

  const {
    defaultsDialogOpen,
    setDefaultsDialogOpen,
    allowSkipInDialog,
    dialogInitialPreference,
    savedDefaultsApplied,
    urlFiltersActive,
    openDefaultsDialog,
    handleSaveDefaults,
    handleSkipDefaults,
    resetUrlFilters,
  } = useBoardDefaultsBootstrap({
    userId: showWorkspaceDefaults ? (currentUserId ?? null) : null,
    basePath: '/work-items',
    needsClientBootstrap: showWorkspaceDefaults && needsClientBootstrap,
    projectFilter,
    sprintFilter,
    projects,
    sprints,
    suggestedDefaults,
  });

  const listDescription = resolveWorkItemsListDescription({
    isAssigneeLocked,
    isProjectLocked,
    isHierarchy,
  });

  const sprintOptions = useMemo(
    () => buildSprintFilterOptions(sprints, projectFilter),
    [projectFilter, sprints]
  );

  const handleProjectChange = useCallback(
    (nextProject: string) => {
      const params = new URLSearchParams(searchParams.toString());
      applyProjectFilterToSearchParams(params, {
        nextProject,
        sprints,
        allValue: projectQuery.allValue,
        pageMode: 'one',
      });
      applyWorkItemListViewParam(params, listView);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [listView, pathname, projectQuery.allValue, router, searchParams, sprints]
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
    isExpandingAll,
    toggleExpand: handleToggleExpand,
    expandAll: handleExpandAll,
    collapseAll: handleCollapseAll,
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
    ]
  );

  const table = useReactTable({
    data: displayRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.workItem.id,
  });

  return (
    <div className="space-y-6">
      <DismissibleError message={error} onDismiss={() => setError(null)} />

      <WorkItemsTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isProjectLocked={isProjectLocked}
        isAssigneeLocked={isAssigneeLocked}
        isHierarchy={isHierarchy}
        projects={projects}
        projectMembers={projectMembers}
        projectQuery={projectQuery}
        sprintQuery={sprintQuery}
        typeQuery={typeQuery}
        assigneeQuery={assigneeQuery}
        sprintOptions={sprintOptions}
        onProjectChange={handleProjectChange}
        onListViewChange={setListView}
        rootCount={initialWorkItems.length}
        isExpandingAll={isExpandingAll}
        expandedCount={expandedIds.size}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        showWorkspaceDefaults={showWorkspaceDefaults}
        onOpenDefaultsDialog={openDefaultsDialog}
        savedDefaultsApplied={savedDefaultsApplied}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        onCreate={openCreateDialog}
      />

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

      {showWorkspaceDefaults ? (
        <BoardDefaultsDialog
          open={defaultsDialogOpen}
          onOpenChange={setDefaultsDialogOpen}
          projects={projects}
          sprints={sprints}
          initialPreference={dialogInitialPreference}
          onSave={handleSaveDefaults}
          onSkip={handleSkipDefaults}
          allowSkip={allowSkipInDialog}
        />
      ) : null}
    </div>
  );
}
