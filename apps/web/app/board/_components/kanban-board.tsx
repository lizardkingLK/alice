'use client';

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@repo/ui/lib/utils';
import {
  AlertCircle,
  Calendar,
  FolderDot,
  Plus,
  SquareArrowOutUpRight,
} from '@repo/ui/lib/icons';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Card } from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  parseWorkItemLabels,
  parseWorkItemLabelsFilterParam,
} from '@repo/types';
import { formatLabelWithSpace } from '@/app/_shared/utility';
import {
  assignItemsToColumns,
  resolveItemColumnId,
} from '@/app/board/_helpers/board-columns';
import {
  BoardLayoutMenu,
  useBoardLayout,
} from '@/app/board/_components/board-layout-menu';
import { BoardGroupedColumnsView } from '@/app/board/_components/board-grouped-columns-view';
import { useBoardDefaultsBootstrap } from '@/app/board/_hooks/use-board-defaults-bootstrap';
import { useBoardFilterActions } from '@/app/board/_hooks/use-board-filter-actions';
import { useBoardStatusMoves } from '@/app/board/_hooks/use-board-status-moves';
import { useBoardSyncPrefs } from '@/app/board/_hooks/use-board-sync-prefs';
import { PendingSyncIndicator } from '@/components/pending-sync-indicator';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { PriorityBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-priority';
import { WorkItemStatusBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-status';
import { WorkItemTypeBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-type';
import { WorkItemFormDialog } from '@/app/work-items/_components/work-item-form/work-item-form-dialog';
import { DescriptionView } from '@/app/work-items/_components/work-item-description/work-item-description-view';
import {
  WorkItemsFilterDialog,
  type WorkItemsFilterFieldId,
} from '@/app/work-items/_components/work-item-registry/work-items-filter-dialog';
import type { FilterQuery } from '@/app/work-items/_components/work-item-table/work-items-table-types';
import { descriptionToPlainText } from '@/app/work-items/_helpers/work-item-description';
import {
  PRIORITY_LABELS,
  type WorkItemPriority,
} from '@/app/work-items/_helpers/work-item-priority-ui';
import { BOARD_STATUS_COLUMN_ACCENTS } from '@/app/work-items/_helpers/work-item-status';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { AppliedFilterBadges } from '@/components/applied-filter-badges';
import { buildAppliedFilterBadgeItems } from '@/components/applied-filter-badges.model';
import { SearchInput } from '@/components/search-input';
import { AssigneeAvatarFilter } from '@/components/assignee-avatar-filter';
import { UserAvatar } from '@/components/user-avatar';
import { WorkItemPreviewCardBody } from '@/components/work-item-preview-card';
import { useRealtime } from '@/components/realtime/realtime-provider';
import {
  QUERY_FILTER_ALL_VALUE,
  useQueryFilter,
} from '@/hooks/use-query-filter';
import { type BoardColumn, type BoardWorkflowTab } from '@repo/types/api/v1';

type BoardStatus = BoardColumn['status'];

const IDLE_FILTER_QUERY: FilterQuery = {
  value: QUERY_FILTER_ALL_VALUE,
  setFilter: () => undefined,
  setValue: () => undefined,
  allValue: QUERY_FILTER_ALL_VALUE,
};

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function assigneeName(item: DbWorkItem) {
  return item.assignee?.name?.trim() || 'Unassigned';
}

function resolveActiveWorkflowBindings(
  boardMode: 'workflow' | 'legacy' | 'default',
  activeWorkflowId: string | null,
  workflowTabs: readonly BoardWorkflowTab[]
): ReadonlySet<string> | null {
  if (boardMode !== 'workflow' || !activeWorkflowId) {
    return null;
  }
  const tab = workflowTabs.find(
    (candidate) => candidate.id === activeWorkflowId
  );
  return tab ? new Set(tab.typeBindings) : null;
}

function itemMatchesBoardFilters(
  item: DbWorkItem,
  params: {
    readonly query: string;
    readonly priorityFilter: string;
    readonly assigneeFilter: string | null;
    readonly activeLabels: readonly string[];
    readonly activeWorkflowBindings: ReadonlySet<string> | null;
  }
): boolean {
  if (item.status === 'Draft') {
    return false;
  }

  if (
    params.activeWorkflowBindings &&
    params.activeWorkflowBindings.size > 0 &&
    !params.activeWorkflowBindings.has(item.type)
  ) {
    return false;
  }

  const description = descriptionToPlainText(item.description ?? null);
  const assignee = assigneeName(item).toLowerCase();
  const matchesSearch =
    !params.query ||
    item.title.toLowerCase().includes(params.query) ||
    item.id.toLowerCase().includes(params.query) ||
    description.toLowerCase().includes(params.query) ||
    assignee.includes(params.query) ||
    item.type.toLowerCase().includes(params.query);
  const matchesPriority =
    params.priorityFilter === QUERY_FILTER_ALL_VALUE ||
    item.priority === params.priorityFilter;
  const matchesAssignee =
    !params.assigneeFilter || item.assignee_id === params.assigneeFilter;
  const itemLabels = parseWorkItemLabels(item.labels);
  const matchesLabels =
    params.activeLabels.length === 0 ||
    params.activeLabels.some((label) => itemLabels.includes(label));

  return matchesSearch && matchesPriority && matchesAssignee && matchesLabels;
}

type KanbanBoardProps = {
  readonly boardColumns: BoardColumn[];
  readonly usesCustomBoardConfig: boolean;
  readonly workflowTabs?: readonly BoardWorkflowTab[];
  readonly activeWorkflowId?: string | null;
  readonly boardMode?: 'workflow' | 'legacy' | 'default';
  readonly initialWorkItems: DbWorkItem[];
  readonly projects: Project[];
  readonly sprints: Sprint[];
  readonly projectFilter: string;
  readonly sprintFilter: string;
  readonly allowAllFilters: boolean;
  readonly userId: string | null;
  readonly needsClientBootstrap: boolean;
};

type BoardAssigneeOption = {
  readonly id: string;
  readonly name: string;
  readonly profilePicture: string | null;
};

function resolveScopedProjectId(
  projectValue: string,
  projectAllValue: string
): string | null {
  if (!projectValue || projectValue === projectAllValue) {
    return null;
  }
  return projectValue;
}

function projectsForCreate(
  projects: readonly Project[],
  projectValue: string,
  projectAllValue: string
): Project[] {
  if (!projectValue || projectValue === projectAllValue) {
    return [...projects];
  }
  return projects.filter((project) => project.id === projectValue);
}

function collectUniqueAssignees(
  workItems: readonly DbWorkItem[]
): BoardAssigneeOption[] {
  const byId = new Map<string, BoardAssigneeOption>();
  for (const item of workItems) {
    if (!item.assignee_id || !item.assignee?.name) {
      continue;
    }
    byId.set(item.assignee_id, {
      id: item.assignee_id,
      name: item.assignee.name,
      profilePicture: item.assignee.profile_picture?.trim() || null,
    });
  }
  return Array.from(byId.values());
}

function buildBoardAppliedFilterItems(params: {
  readonly search: string;
  readonly projectFilterActive: boolean;
  readonly projectId: string;
  readonly projects: readonly Project[];
  readonly sprintFilterActive: boolean;
  readonly sprintId: string;
  readonly sprints: readonly Sprint[];
  readonly priorityFilter: string;
  readonly assigneeFilter: string | null;
  readonly uniqueAssignees: readonly BoardAssigneeOption[];
  readonly activeLabels: readonly string[];
}) {
  return buildAppliedFilterBadgeItems({
    search: params.search,
    project: params.projectFilterActive
      ? {
          id: params.projectId,
          name:
            params.projects.find((project) => project.id === params.projectId)
              ?.name ?? params.projectId,
        }
      : null,
    sprint: params.sprintFilterActive
      ? {
          id: params.sprintId,
          name:
            params.sprints.find((sprint) => sprint.id === params.sprintId)
              ?.name ?? params.sprintId,
        }
      : null,
    priority:
      params.priorityFilter !== QUERY_FILTER_ALL_VALUE
        ? {
            id: params.priorityFilter,
            name:
              PRIORITY_LABELS[params.priorityFilter as WorkItemPriority] ??
              formatLabelWithSpace(params.priorityFilter),
          }
        : null,
    assignee: params.assigneeFilter
      ? {
          id: params.assigneeFilter,
          name:
            params.uniqueAssignees.find(
              (assignee) => assignee.id === params.assigneeFilter
            )?.name ?? 'Assignee',
        }
      : null,
    labels: params.activeLabels,
  });
}

function BoardStatusErrorBanner({
  message,
  onDismiss,
}: Readonly<{
  readonly message: string;
  readonly onDismiss: () => void;
}>) {
  return (
    <div className="bg-destructive/10 text-destructive border-destructive/20 flex shrink-0 items-start gap-2 rounded-lg border px-3 py-2 text-sm">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-1 items-start justify-between gap-3">
        <p>{message}</p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-destructive hover:text-destructive"
          onClick={onDismiss}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function createWorkItemDialogDescription(
  createStatus: BoardStatus | null
): string {
  if (!createStatus) {
    return 'Create a work item.';
  }
  return `Create a work item in ${formatLabelWithSpace(createStatus)}.`;
}

function resolveCreateDialogProjects(
  lockCreateProject: boolean,
  createProjects: readonly Project[],
  projects: readonly Project[]
): Project[] {
  if (lockCreateProject && createProjects[0]) {
    return [...createProjects];
  }
  return [...projects];
}

function resolveDefaultSprintId(
  sprintValue: string,
  sprintAllValue: string
): string | null {
  if (sprintValue && sprintValue !== sprintAllValue) {
    return sprintValue;
  }
  return null;
}

function BoardWorkItemPreviewDialog({
  open,
  onOpenChange,
  selectedTask,
  boardColumns,
  pendingStatusIds,
  isUserOnline,
  onApplyStatusChange,
}: Readonly<{
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- callback
  readonly onOpenChange: (open: boolean) => void;
  readonly selectedTask: DbWorkItem | null;
  readonly boardColumns: readonly BoardColumn[];
  readonly pendingStatusIds: ReadonlySet<string>;
  // eslint-disable-next-line no-unused-vars -- callback
  readonly isUserOnline: (userId: string) => boolean;
  // eslint-disable-next-line no-unused-vars -- callback
  readonly onApplyStatusChange: (id: string, column: BoardColumn) => void;
}>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-x-hidden sm:max-w-xl">
        {selectedTask ? (
          <>
            <DialogHeader>
              <div className="mb-1 flex items-center justify-between gap-3 pr-6">
                <Badge variant="outline" className="font-mono">
                  {shortId(selectedTask.id)}
                </Badge>
                <PriorityBadge priority={selectedTask.priority} />
              </div>
              <DialogTitle className="text-foreground text-xl">
                {selectedTask.title}
              </DialogTitle>
              <DialogDescription>
                Preview this work item or move it between board columns. Status
                changes are saved immediately.
              </DialogDescription>
            </DialogHeader>

            <div className="min-w-0 space-y-5 text-sm">
              <div className="space-y-2.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Description
                </p>
                <div className="bg-muted/40 max-h-56 overflow-x-hidden overflow-y-auto rounded-lg border p-3">
                  <DescriptionView
                    description={selectedTask.description ?? null}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/20 rounded-lg border p-3">
                  <p className="text-muted-foreground mb-2.5 text-[10px] font-medium tracking-wide uppercase">
                    Assignee
                  </p>
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      name={assigneeName(selectedTask)}
                      imageUrl={selectedTask.assignee?.profile_picture}
                      title={assigneeName(selectedTask)}
                      isOnline={Boolean(
                        selectedTask.assignee_id &&
                        isUserOnline(selectedTask.assignee_id)
                      )}
                      className="size-6"
                      fallbackClassName="bg-primary text-primary-foreground text-[10px] font-medium"
                    />
                    <span className="text-foreground text-xs font-medium">
                      {assigneeName(selectedTask)}
                    </span>
                  </div>
                </div>

                <div className="bg-muted/20 rounded-lg border p-3">
                  <p className="text-muted-foreground mb-2.5 text-[10px] font-medium tracking-wide uppercase">
                    Type
                  </p>
                  <WorkItemTypeBadge type={selectedTask.type} />
                </div>

                <div className="bg-muted/20 rounded-lg border p-3">
                  <p className="text-muted-foreground mb-2.5 text-[10px] font-medium tracking-wide uppercase">
                    Due date
                  </p>
                  <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                    <Calendar className="text-primary size-3.5" />
                    {selectedTask.due_date ?? 'Not set'}
                  </span>
                </div>

                <div className="bg-muted/20 rounded-lg border p-3">
                  <p className="text-muted-foreground mb-2.5 text-[10px] font-medium tracking-wide uppercase">
                    Status
                  </p>
                  <WorkItemStatusBadge status={selectedTask.status} />
                </div>
              </div>

              <div className="space-y-2.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Move to
                </p>
                <div className="flex flex-wrap gap-2">
                  {boardColumns.map((column) => (
                    <Button
                      key={column.id}
                      type="button"
                      variant={
                        resolveItemColumnId(selectedTask, boardColumns) ===
                        column.id
                          ? 'default'
                          : 'outline'
                      }
                      size="sm"
                      disabled={pendingStatusIds.has(selectedTask.id)}
                      onClick={() =>
                        onApplyStatusChange(selectedTask.id, column)
                      }
                    >
                      {column.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 border-t pt-4 sm:justify-between">
              <Button asChild variant="outline">
                <a
                  href={`/work-items/${selectedTask.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open details
                  <SquareArrowOutUpRight />
                </a>
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type BoardClassicColumnsProps = {
  readonly boardColumns: readonly BoardColumn[];
  readonly columnItemsMap: ReadonlyMap<string, DbWorkItem[]>;
  readonly activeDropCol: string | null;
  readonly draggedTaskId: string | null;
  readonly pendingStatusIds: ReadonlySet<string>;
  readonly dimPendingCards: boolean;
  // eslint-disable-next-line no-unused-vars -- callback
  readonly onSelectItem: (item: DbWorkItem) => void;
  // eslint-disable-next-line no-unused-vars -- callback
  readonly onCreateInColumn: (column: BoardColumn) => void;
  // eslint-disable-next-line no-unused-vars -- callback
  readonly onItemDragStart: (event: DragEvent, id: string) => void;
  readonly onItemDragEnd: () => void;
  // eslint-disable-next-line no-unused-vars -- callback
  readonly onColumnDragOver: (event: DragEvent, colId: string) => void;
  readonly onColumnDragLeave: () => void;
  // eslint-disable-next-line no-unused-vars -- callback
  readonly onColumnDrop: (event: DragEvent, column: BoardColumn) => void;
  // eslint-disable-next-line no-unused-vars -- callback
  readonly isUserOnline: (userId: string) => boolean;
};

function BoardClassicColumns({
  boardColumns,
  columnItemsMap,
  activeDropCol,
  draggedTaskId,
  pendingStatusIds,
  dimPendingCards,
  onSelectItem,
  onCreateInColumn,
  onItemDragStart,
  onItemDragEnd,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
  isUserOnline,
}: Readonly<BoardClassicColumnsProps>) {
  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-1">
      {boardColumns.map((column) => {
        const columnItems = columnItemsMap.get(column.id) ?? [];
        const isOver = activeDropCol === column.id;

        return (
          <section
            key={column.id}
            aria-label={column.name}
            className={cn(
              'bg-muted/25 flex h-full min-h-0 w-72 min-w-72 flex-1 flex-col rounded-xl border border-t-4 p-3 transition-colors',
              BOARD_STATUS_COLUMN_ACCENTS[column.status],
              isOver && 'border-primary bg-primary/5 border-dashed'
            )}
            onDragOver={(event) => onColumnDragOver(event, column.id)}
            onDragLeave={onColumnDragLeave}
            onDrop={(event) => onColumnDrop(event, column)}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <WorkItemStatusBadge status={column.status} label={column.name} />
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary">{columnItems.length}</Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="cursor-pointer"
                      aria-label={`Create work item in ${column.name}`}
                      onClick={() => onCreateInColumn(column)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Create in {column.name}</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <ScrollArea className="h-0 min-h-0 flex-1">
              <div className="flex w-full flex-col gap-3 pb-1">
                {columnItems.length === 0 ? (
                  <div className="text-muted-foreground flex min-h-40 w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center text-xs">
                    <FolderDot className="text-muted-foreground/50 mb-2 size-8 stroke-1" />
                    No work items in this stage
                  </div>
                ) : (
                  columnItems.map((item) => {
                    const description = descriptionToPlainText(
                      item.description ?? null
                    );
                    const isPendingDim =
                      dimPendingCards && pendingStatusIds.has(item.id);

                    return (
                      <Card
                        key={item.id}
                        draggable
                        onDragStart={(event) => onItemDragStart(event, item.id)}
                        onDragEnd={onItemDragEnd}
                        onClick={() => onSelectItem(item)}
                        className={cn(
                          'group w-full max-w-full min-w-0 cursor-grab border border-b-[3px] py-0 shadow-sm active:cursor-grabbing',
                          (draggedTaskId === item.id || isPendingDim) &&
                            'opacity-40'
                        )}
                      >
                        <WorkItemPreviewCardBody
                          title={item.title}
                          type={item.type}
                          priority={item.priority}
                          descriptionPlain={description || null}
                          assigneeName={assigneeName(item)}
                          assigneeImageUrl={item.assignee?.profile_picture}
                          isAssigneeOnline={Boolean(
                            item.assignee_id && isUserOnline(item.assignee_id)
                          )}
                          titleClassName="group-hover:text-primary transition-colors"
                        />
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </section>
        );
      })}
    </div>
  );
}

export function KanbanBoard({
  boardColumns,
  usesCustomBoardConfig,
  workflowTabs = [],
  activeWorkflowId = null,
  boardMode = 'default',
  initialWorkItems,
  projects,
  sprints,
  projectFilter,
  sprintFilter,
  allowAllFilters,
  userId,
  needsClientBootstrap,
}: Readonly<KanbanBoardProps>) {
  const { isUserOnline } = useRealtime();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { layout, setLayout } = useBoardLayout(userId);
  const { prefs: syncPrefs, setPrefs: setSyncPrefs } =
    useBoardSyncPrefs(userId);
  const [workItems, setWorkItems] = useState<DbWorkItem[]>(initialWorkItems);
  const [createStatus, setCreateStatus] = useState<BoardStatus | null>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);

  useEffect(() => {
    setWorkItems(initialWorkItems);
  }, [initialWorkItems]);

  const boardDefaults = useBoardDefaultsBootstrap({
    userId,
    needsClientBootstrap,
    projectFilter,
    sprintFilter,
    projects,
    sprints,
  });
  const { saveDefaults } = boardDefaults;

  const projectQuery = useQueryFilter('project', projectFilter);
  const sprintQuery = useQueryFilter('sprint', sprintFilter);
  const labelsQuery = useQueryFilter(
    'labels',
    searchParams.get('labels')?.trim() || ''
  );
  const { setValue: setProjectFilterValue, allValue: projectAllValue } =
    projectQuery;
  const { setValue: setSprintFilterValue } = sprintQuery;
  const { setValue: setLabelsFilterValue } = labelsQuery;
  const realtimeProjectId = resolveScopedProjectId(
    projectQuery.value,
    projectAllValue
  );
  const activeLabels = useMemo(
    () => parseWorkItemLabelsFilterParam(labelsQuery.value) ?? [],
    [labelsQuery.value]
  );

  const createProjects = useMemo(
    () => projectsForCreate(projects, projectQuery.value, projectAllValue),
    [projectAllValue, projectQuery.value, projects]
  );

  const lockCreateProject =
    createProjects.length === 1 &&
    Boolean(projectQuery.value) &&
    projectQuery.value !== projectAllValue;

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [activeDropCol, setActiveDropCol] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<DbWorkItem | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const { pendingStatusIds, dimPendingCards, applyStatusChange } =
    useBoardStatusMoves({
      workItems,
      setWorkItems,
      setSelectedTask,
      boardColumns,
      usesCustomBoardConfig,
      userId,
      syncPrefs,
      realtimeProjectId,
      setStatusError,
    });

  const uniqueAssignees = useMemo(
    () => collectUniqueAssignees(workItems),
    [workItems]
  );

  const boardFilterFieldIds = useMemo(() => {
    const fields: WorkItemsFilterFieldId[] = [];
    if (allowAllFilters || projects.length > 0) {
      fields.push('project');
    }
    fields.push('sprint', 'priority', 'labels');
    return fields;
  }, [allowAllFilters, projects.length]);

  const priorityQuery = useMemo<FilterQuery>(
    () => ({
      value: priorityFilter,
      setFilter: (value) => setPriorityFilter(value || QUERY_FILTER_ALL_VALUE),
      setValue: (value) => setPriorityFilter(value || QUERY_FILTER_ALL_VALUE),
      allValue: QUERY_FILTER_ALL_VALUE,
    }),
    [priorityFilter]
  );

  const hasLabelsFilter = activeLabels.length > 0;
  const projectFilterActive = Boolean(
    projectQuery.value && projectQuery.value !== projectAllValue
  );
  const sprintFilterActive = Boolean(
    sprintQuery.value && sprintQuery.value !== sprintQuery.allValue
  );
  const hasLocalFilters =
    search.trim() !== '' ||
    priorityFilter !== QUERY_FILTER_ALL_VALUE ||
    assigneeFilter !== null ||
    hasLabelsFilter;
  const hasActiveFilters =
    hasLocalFilters || projectFilterActive || sprintFilterActive;
  const hasDialogFilters =
    projectFilterActive ||
    sprintFilterActive ||
    priorityFilter !== QUERY_FILTER_ALL_VALUE ||
    hasLabelsFilter;

  const { handleApplyFilters, handleClearFilters, handleRemoveAppliedFilter } =
    useBoardFilterActions({
      allowAllFilters,
      projectsCount: projects.length,
      projectAllValue,
      sprintAllValue: sprintQuery.allValue,
      activeLabels,
      projectFilterActive,
      sprintFilterActive,
      hasLabelsFilter,
      setSearch,
      setPriorityFilter,
      setAssigneeFilter,
      setProjectFilterValue,
      setSprintFilterValue,
      setLabelsFilterValue,
    });

  const appliedFilterItems = useMemo(
    () =>
      buildBoardAppliedFilterItems({
        search,
        projectFilterActive,
        projectId: projectQuery.value,
        projects,
        sprintFilterActive,
        sprintId: sprintQuery.value,
        sprints,
        priorityFilter,
        assigneeFilter,
        uniqueAssignees,
        activeLabels,
      }),
    [
      activeLabels,
      assigneeFilter,
      priorityFilter,
      projectFilterActive,
      projectQuery.value,
      projects,
      search,
      sprintFilterActive,
      sprintQuery.value,
      sprints,
      uniqueAssignees,
    ]
  );

  const activeWorkflowBindings = useMemo(
    () =>
      resolveActiveWorkflowBindings(boardMode, activeWorkflowId, workflowTabs),
    [boardMode, activeWorkflowId, workflowTabs]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return workItems.filter((item) =>
      itemMatchesBoardFilters(item, {
        query,
        priorityFilter,
        assigneeFilter,
        activeLabels,
        activeWorkflowBindings,
      })
    );
  }, [
    workItems,
    search,
    priorityFilter,
    assigneeFilter,
    activeLabels,
    activeWorkflowBindings,
  ]);

  const columnItemsMap = useMemo(() => {
    return assignItemsToColumns(filteredItems, boardColumns);
  }, [filteredItems, boardColumns]);

  const handleDragStart = (event: DragEvent, id: string) => {
    event.dataTransfer.setData('text/plain', id);
    setDraggedTaskId(id);
  };

  const handleDragOver = (event: DragEvent, colId: string) => {
    event.preventDefault();
    if (activeDropCol !== colId) {
      setActiveDropCol(colId);
    }
  };

  const handleDragLeave = () => {
    setActiveDropCol(null);
  };

  const handleDrop = (event: DragEvent, targetColumn: BoardColumn) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain') || draggedTaskId;
    if (id) {
      applyStatusChange(id, targetColumn);
    }
    setDraggedTaskId(null);
    setActiveDropCol(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setActiveDropCol(null);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
      {needsClientBootstrap ? (
        <div className="text-muted-foreground shrink-0 rounded-lg border px-3 py-2 text-sm">
          Loading your board defaults…
        </div>
      ) : null}

      {statusError ? (
        <BoardStatusErrorBanner
          message={statusError}
          onDismiss={() => setStatusError(null)}
        />
      ) : null}

      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-3">
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search work items..."
            className="shrink-0 sm:w-64"
          />

          <WorkItemsFilterDialog
            projects={projects}
            projectMembers={[]}
            sprints={sprints}
            projectQuery={projectQuery}
            sprintQuery={sprintQuery}
            typeQuery={IDLE_FILTER_QUERY}
            assigneeQuery={IDLE_FILTER_QUERY}
            labelsQuery={labelsQuery}
            priorityQuery={priorityQuery}
            visibleFieldIds={boardFilterFieldIds}
            isProjectLocked={!allowAllFilters && projects.length === 0}
            isAssigneeLocked
            onApplyFilters={handleApplyFilters}
            onSaveWorkspaceDefaults={userId ? saveDefaults : undefined}
            hasActiveFilters={hasDialogFilters}
          />

          <AssigneeAvatarFilter
            members={uniqueAssignees}
            selectedId={assigneeFilter}
            onSelectedIdChange={setAssigneeFilter}
            visibleCount={3}
            isUserOnline={isUserOnline}
          />

          {hasActiveFilters ? (
            <AppliedFilterBadges
              items={appliedFilterItems}
              onRemove={handleRemoveAppliedFilter}
              onClearAll={handleClearFilters}
            />
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 self-start sm:self-auto">
          <PendingSyncIndicator active={pendingStatusIds.size > 0} />
          <BoardLayoutMenu
            layout={layout}
            onLayoutChange={setLayout}
            syncPrefs={syncPrefs}
            onSyncPrefsChange={setSyncPrefs}
          />
        </div>
      </div>

      {layout === 'grouped' ? (
        <BoardGroupedColumnsView
          boardColumns={boardColumns}
          columnItemsMap={columnItemsMap}
          activeDropCol={activeDropCol}
          draggedTaskId={draggedTaskId}
          pendingStatusIds={dimPendingCards ? pendingStatusIds : new Set()}
          onSelectItem={(item) => {
            setSelectedTask(item);
            setIsDetailOpen(true);
          }}
          onCreateInColumn={(column) => setCreateStatus(column.status)}
          onItemDragStart={handleDragStart}
          onItemDragEnd={handleDragEnd}
          onColumnDragOver={handleDragOver}
          onColumnDragLeave={handleDragLeave}
          onColumnDrop={handleDrop}
        />
      ) : (
        <BoardClassicColumns
          boardColumns={boardColumns}
          columnItemsMap={columnItemsMap}
          activeDropCol={activeDropCol}
          draggedTaskId={draggedTaskId}
          pendingStatusIds={pendingStatusIds}
          dimPendingCards={dimPendingCards}
          onSelectItem={(item) => {
            setSelectedTask(item);
            setIsDetailOpen(true);
          }}
          onCreateInColumn={(column) => setCreateStatus(column.status)}
          onItemDragStart={handleDragStart}
          onItemDragEnd={handleDragEnd}
          onColumnDragOver={handleDragOver}
          onColumnDragLeave={handleDragLeave}
          onColumnDrop={handleDrop}
          isUserOnline={isUserOnline}
        />
      )}

      <BoardWorkItemPreviewDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        selectedTask={selectedTask}
        boardColumns={boardColumns}
        pendingStatusIds={pendingStatusIds}
        isUserOnline={isUserOnline}
        onApplyStatusChange={applyStatusChange}
      />

      <WorkItemFormDialog
        open={createStatus !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateStatus(null);
          }
        }}
        title="Create Work Item"
        description={createWorkItemDialogDescription(createStatus)}
        projects={resolveCreateDialogProjects(
          lockCreateProject,
          createProjects,
          projects
        )}
        projectMembers={[]}
        lockProject={lockCreateProject}
        lockStatus={Boolean(createStatus)}
        defaultStatus={createStatus ?? undefined}
        defaultSprintId={resolveDefaultSprintId(
          sprintQuery.value,
          sprintQuery.allValue
        )}
        onClose={() => setCreateStatus(null)}
        onSuccess={(created) => {
          setWorkItems((current) => [created, ...current]);
          setCreateStatus(null);
          router.refresh();
        }}
      />
    </div>
  );
}
