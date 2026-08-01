'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ChevronDown,
  ChevronRight,
  ClipboardPenLine,
  List,
  ListTree,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash,
  X,
} from '@repo/ui/lib/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { WorkItemFormDialog } from '@/app/work-items/_components/work-item-form-dialog';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { WorkItemWorkspaceProps } from '@/app/work-items/_components/workItems-workspace';
import {
  flattenWorkItemHierarchyRows,
  type WorkItemHierarchyDisplayRow,
} from '@/app/work-items/_helpers/work-item-hierarchy-rows';
import { useWorkItemHierarchy } from '@/app/work-items/_hooks/use-work-item-hierarchy';
import {
  applyProjectFilterToSearchParams,
  buildSprintFilterOptions,
} from '@/app/board/_services/board-defaults';
import { BoardDefaultsDialog } from '@/app/board/_components/board-defaults-dialog';
import { WorkspaceDefaultsControls } from '@/app/board/_components/workspace-defaults-controls';
import { useBoardDefaultsBootstrap } from '@/app/board/_hooks/use-board-defaults-bootstrap';
import { formatDate } from '@/app/_shared/utility';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import { WorkItemTypeBadge } from '@/app/work-items/_components/workItem-badge-type';
import Link from 'next/link';
import { cn } from '@repo/ui/lib/utils';
import { Pagination } from '@/components/pagination';
import { DataTable } from '@/components/data-table';
import { SearchInput } from '@/components/search-input';
import { DismissibleError } from '@/components/dismissible-error';
import { ListFilterSelect } from '@/components/list-filter-select';
import { UserAvatar } from '@/components/user-avatar';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { useQueryFilter } from '@/hooks/use-query-filter';
import { usePathname, useSearchParams } from 'next/navigation';
import { Constants } from '@repo/types/database';
import { workItemDetailHref } from '@/app/work-items/_helpers/work-item-links';
import type { WorkItemListView } from '@/lib/search-params';

/** Match DialogContent `duration-200` so edit UI doesn't flash to create while closing. */
const DIALOG_CLOSE_MS = 200;

const WORK_ITEM_FILTER_PARAMS = [
  'search',
  'project',
  'sprint',
  'type',
  'assignee',
] as const;

const TITLE_INDENT_CLASS = ['pl-0', 'pl-4', 'pl-8', 'pl-12'] as const;

type WorkItemsTableProps = WorkItemWorkspaceProps;

type DisplayRow = WorkItemHierarchyDisplayRow;

/** Shared by status/type/priority badge cell renderers (flat `DbWorkItem` rows). */
export type RendererProps = { row: Row<DbWorkItem> };

type HierarchyRendererProps = { row: Row<DisplayRow> };

function HierarchyExpandIcon({
  isLoading,
  isExpanded,
}: Readonly<{ isLoading: boolean; isExpanded: boolean }>) {
  if (isLoading) {
    return <Loader2 className="size-4 animate-spin" />;
  }
  if (isExpanded) {
    return <ChevronDown className="size-4" />;
  }
  return <ChevronRight className="size-4" />;
}

const titleRenderer = ({
  row,
  fromProjectId,
  fromAssigneeId,
  isHierarchy,
  onToggleExpand,
}: HierarchyRendererProps & {
  fromProjectId?: string | null;
  fromAssigneeId?: string | null;
  isHierarchy: boolean;
  // eslint-disable-next-line no-unused-vars -- expand toggle callback
  onToggleExpand?: (workItemId: string) => void;
}) => {
  const { workItem, depth, canExpand, isExpanded, isLoading } = row.original;
  const indentClass =
    TITLE_INDENT_CLASS[Math.min(depth, TITLE_INDENT_CLASS.length - 1)] ??
    'pl-12';

  return (
    <div className={cn('flex min-w-48 items-center gap-2', indentClass)}>
      {isHierarchy ? (
        <div className="flex size-7 shrink-0 items-center justify-center">
          {canExpand ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7 cursor-pointer"
              aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
              aria-expanded={isExpanded}
              disabled={isLoading}
              onClick={(event) => {
                event.preventDefault();
                onToggleExpand?.(workItem.id);
              }}
            >
              <HierarchyExpandIcon
                isLoading={isLoading}
                isExpanded={isExpanded}
              />
            </Button>
          ) : (
            <span className="size-7" aria-hidden />
          )}
        </div>
      ) : null}
      <Link
        className="flex min-w-0 flex-1 items-center gap-3"
        href={workItemDetailHref(workItem.id, {
          fromProjectId,
          fromAssigneeId,
        })}
      >
        <div
          className={cn(
            'bg-primary/10 text-primary border-primary/20',
            'flex size-8 shrink-0 items-center justify-center',
            'rounded-lg border text-xs font-bold'
          )}
        >
          {workItem.title.slice(0, 1).toUpperCase()}
        </div>
        <div className="space-y-1 font-medium">
          {workItem.title}
          <p className="text-muted-foreground text-xs">
            Created {formatDate(workItem.created_at)}
          </p>
        </div>
      </Link>
    </div>
  );
};

const assigneeRenderer = ({
  row,
  currentUserId,
}: HierarchyRendererProps & { currentUserId?: string | null }) => {
  const assignee = row.original.workItem.assignee;
  const assigneeName = assignee?.name ?? '—';
  const isAssignedToSelf = row.original.workItem.assignee_id === currentUserId;

  if (!assignee) {
    return <p className="text-muted-foreground font-medium">{assigneeName}</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <UserAvatar
        name={assignee.name}
        imageUrl={assignee.profile_picture}
        title={assigneeName}
      />
      <div className="space-y-1">
        <p className="font-medium">{assigneeName}</p>
        {isAssignedToSelf ? (
          <Badge variant="secondary" className="text-[10px]">
            You
          </Badge>
        ) : null}
      </div>
    </div>
  );
};

const dueDateRenderer = ({ row }: HierarchyRendererProps) => (
  <span className="text-muted-foreground">
    {formatDate(row.original.workItem.due_date)}
  </span>
);

const actionsHeaderRenderer = () => <span className="sr-only">Actions</span>;

const actionsRenderer = ({
  row,
  openEditDialog,
}: HierarchyRendererProps & {
  // eslint-disable-next-line no-unused-vars
  openEditDialog: (workItem: DbWorkItem) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon-sm" className="cursor-pointer">
        <MoreHorizontal />
        <span className="sr-only">Open menu</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => openEditDialog(row.original.workItem)}>
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

const WORK_ITEM_TYPES = Constants.public.Enums.WorkItemType;

function resolveWorkItemsListDescription(options: {
  readonly isAssigneeLocked: boolean;
  readonly isProjectLocked: boolean;
  readonly isHierarchy: boolean;
}): string {
  if (options.isAssigneeLocked) {
    return 'View and manage work items assigned to you.';
  }
  if (options.isProjectLocked) {
    return 'View, filter, and manage work items for this project.';
  }
  if (options.isHierarchy) {
    return 'Browse root work items and expand to view nested subtasks.';
  }
  return 'View, filter, and manage work items across your workspace.';
}

function buildWorkItemDisplayRows(options: {
  readonly isHierarchy: boolean;
  readonly roots: readonly DbWorkItem[];
  readonly childrenByParentId: ReadonlyMap<string, readonly DbWorkItem[]>;
  readonly expandedIds: ReadonlySet<string>;
  readonly loadingIds: ReadonlySet<string>;
}): DisplayRow[] {
  if (!options.isHierarchy) {
    return options.roots.map((workItem) => ({
      workItem,
      depth: 0,
      canExpand: false,
      isExpanded: false,
      isLoading: false,
    }));
  }

  return flattenWorkItemHierarchyRows(
    options.roots,
    options.childrenByParentId,
    options.expandedIds,
    options.loadingIds
  );
}

function hasActiveWorkItemFilters(options: {
  readonly searchParams: URLSearchParams;
  readonly isProjectLocked: boolean;
  readonly isAssigneeLocked: boolean;
  readonly showWorkspaceDefaults: boolean;
  readonly urlFiltersActive: boolean;
}): boolean {
  return WORK_ITEM_FILTER_PARAMS.some((key) => {
    if (key === 'project' && options.isProjectLocked) {
      return false;
    }
    if (key === 'sprint' && options.isProjectLocked) {
      return false;
    }
    if (key === 'assignee' && options.isAssigneeLocked) {
      return false;
    }
    if (
      options.showWorkspaceDefaults &&
      (key === 'project' || key === 'sprint') &&
      !options.urlFiltersActive
    ) {
      return false;
    }
    return Boolean(options.searchParams.get(key)?.trim());
  });
}

function applyWorkItemListViewParam(
  params: URLSearchParams,
  listView: WorkItemListView
): void {
  if (listView === 'hierarchy') {
    params.set('view', 'hierarchy');
    return;
  }
  params.delete('view');
}

function buildClearedWorkItemFilterParams(options: {
  readonly searchParams: URLSearchParams;
  readonly listView: WorkItemListView;
  readonly lockedProjectId?: string;
  readonly lockedAssigneeId?: string;
}): URLSearchParams {
  const next = new URLSearchParams();
  const limitParam = options.searchParams.get('limit');
  const tabParam = options.searchParams.get('tab');
  if (limitParam) {
    next.set('limit', limitParam);
  }
  if (tabParam) {
    next.set('tab', tabParam);
  }
  applyWorkItemListViewParam(next, options.listView);
  if (options.lockedProjectId) {
    next.set('project', options.lockedProjectId);
  }
  if (options.lockedAssigneeId) {
    next.set('assignee', options.lockedAssigneeId);
  }
  return next;
}

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

  const columns = useMemo<ColumnDef<DisplayRow>[]>(
    () => [
      {
        id: 'title',
        header: 'Title',
        cell: ({ row }) =>
          titleRenderer({
            row,
            fromProjectId: lockedProjectId,
            fromAssigneeId: lockedAssigneeId,
            isHierarchy,
            onToggleExpand: handleToggleExpand,
          }),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <WorkItemTypeBadge type={row.original.workItem.type} />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <WorkItemStatusBadge status={row.original.workItem.status} />
        ),
      },
      {
        id: 'priority',
        header: 'Priority',
        cell: ({ row }) => (
          <PriorityBadge priority={row.original.workItem.priority} />
        ),
      },
      {
        id: 'assignee',
        header: 'Assignee',
        cell: ({ row }) => assigneeRenderer({ row, currentUserId }),
      },
      {
        id: 'due_date',
        header: 'Due Date',
        cell: dueDateRenderer,
      },
      {
        id: 'actions',
        header: actionsHeaderRenderer,
        cell: ({ row }) => actionsRenderer({ row, openEditDialog }),
      },
    ],
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

type FilterQuery = {
  readonly value: string;
  // eslint-disable-next-line no-unused-vars -- filter setter signature
  readonly setFilter: (value: string) => void;
  readonly allValue: string;
};

const WORK_ITEM_LIST_VIEW_OPTIONS = [
  { view: 'flat' as const, label: 'Flat', Icon: List },
  { view: 'hierarchy' as const, label: 'Hierarchy', Icon: ListTree },
] as const;

function WorkItemListViewToggle({
  listView,
  onListViewChange,
}: Readonly<{
  listView: WorkItemListView;
  // eslint-disable-next-line no-unused-vars -- view change callback
  onListViewChange: (view: WorkItemListView) => void;
}>) {
  return (
    <div
      className="border-border flex h-9 items-center rounded-lg border p-0.5"
      aria-label="Work items view mode"
    >
      {WORK_ITEM_LIST_VIEW_OPTIONS.map(({ view, label, Icon }) => {
        const isActive = listView === view;
        return (
          <Button
            key={view}
            type="button"
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 cursor-pointer gap-1.5 px-2.5 text-xs"
            aria-pressed={isActive}
            onClick={() => onListViewChange(view)}
          >
            <Icon className="size-3.5" />
            {label}
          </Button>
        );
      })}
    </div>
  );
}

function WorkItemsTableToolbar({
  searchQuery,
  onSearchChange,
  isProjectLocked,
  isAssigneeLocked,
  isHierarchy,
  projects,
  projectMembers,
  projectQuery,
  sprintQuery,
  typeQuery,
  assigneeQuery,
  sprintOptions,
  onProjectChange,
  onListViewChange,
  rootCount,
  isExpandingAll,
  expandedCount,
  onExpandAll,
  onCollapseAll,
  showWorkspaceDefaults,
  onOpenDefaultsDialog,
  savedDefaultsApplied,
  hasActiveFilters,
  onClearFilters,
  onCreate,
}: Readonly<{
  searchQuery: string;
  // eslint-disable-next-line no-unused-vars
  onSearchChange: (value: string) => void;
  isProjectLocked: boolean;
  isAssigneeLocked: boolean;
  isHierarchy: boolean;
  projects: WorkItemWorkspaceProps['projects'];
  projectMembers: WorkItemWorkspaceProps['projectMembers'];
  projectQuery: FilterQuery;
  sprintQuery: FilterQuery;
  typeQuery: FilterQuery;
  assigneeQuery: FilterQuery;
  sprintOptions: { readonly value: string; readonly label: string }[];
  // eslint-disable-next-line no-unused-vars
  onProjectChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars
  onListViewChange: (view: WorkItemListView) => void;
  rootCount: number;
  isExpandingAll: boolean;
  expandedCount: number;
  onExpandAll: () => Promise<void>;
  onCollapseAll: () => void;
  showWorkspaceDefaults: boolean;
  onOpenDefaultsDialog: () => void;
  savedDefaultsApplied: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
}>) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={searchQuery}
          onValueChange={onSearchChange}
          placeholder="Search work items..."
        />

        {isProjectLocked ? null : (
          <ListFilterSelect
            value={projectQuery.value}
            onValueChange={onProjectChange}
            allValue={projectQuery.allValue}
            allLabel="All Projects"
            ariaLabel="Filter by project"
            placeholder="All Projects"
            triggerClassName="sm:w-44"
            options={projects.map((project) => ({
              value: project.id,
              label: project.name,
            }))}
          />
        )}

        {isProjectLocked ? null : (
          <ListFilterSelect
            value={sprintQuery.value}
            onValueChange={sprintQuery.setFilter}
            allValue={sprintQuery.allValue}
            allLabel="All Sprints"
            ariaLabel="Filter by sprint"
            placeholder="All Sprints"
            triggerClassName="sm:w-44"
            options={sprintOptions}
          />
        )}

        <ListFilterSelect
          value={typeQuery.value}
          onValueChange={typeQuery.setFilter}
          allValue={typeQuery.allValue}
          allLabel="All Types"
          ariaLabel="Filter by type"
          placeholder="All Types"
          triggerClassName="sm:w-36"
          options={WORK_ITEM_TYPES.map((workItemType) => ({
            value: workItemType,
            label: workItemType,
          }))}
        />

        {isAssigneeLocked ? null : (
          <ListFilterSelect
            value={assigneeQuery.value}
            onValueChange={assigneeQuery.setFilter}
            allValue={assigneeQuery.allValue}
            allLabel="All Assignees"
            ariaLabel="Filter by assignee"
            placeholder="All Assignees"
            triggerClassName="sm:w-44"
            options={projectMembers.map((member) => ({
              value: member.id,
              label: member.name,
            }))}
          />
        )}

        <WorkItemListViewToggle
          listView={isHierarchy ? 'hierarchy' : 'flat'}
          onListViewChange={onListViewChange}
        />

        {isHierarchy ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-9 cursor-pointer gap-1.5 px-3 text-xs"
              disabled={isExpandingAll || rootCount === 0}
              onClick={() => {
                void onExpandAll();
              }}
            >
              {isExpandingAll ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              <span>Expand all</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-9 cursor-pointer px-3 text-xs"
              disabled={expandedCount === 0}
              onClick={onCollapseAll}
            >
              Collapse all
            </Button>
          </div>
        ) : null}

        {showWorkspaceDefaults ? (
          <WorkspaceDefaultsControls
            onOpenDefaultsDialog={onOpenDefaultsDialog}
            savedDefaultsApplied={savedDefaultsApplied}
          />
        ) : null}

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground h-9 cursor-pointer px-3 text-xs"
          >
            Clear filters
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <Button onClick={onCreate} className="shrink-0 self-start">
        <Plus />
        Add Work-Item
      </Button>
    </div>
  );
}
