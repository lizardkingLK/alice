'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@repo/ui/lib/utils';
import {
  AlertCircle,
  Calendar,
  FolderDot,
  Plus,
  SquareArrowOutUpRight,
  X,
} from '@repo/ui/lib/icons';
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import { Separator } from '@repo/ui/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { formatLabelWithSpace, getInitials } from '@/app/_shared/utility';
import {
  pickWorkspaceDefaultsDialogController,
  WorkspaceDefaultsDialogHost,
} from '@/app/board/_components/workspace-defaults-dialog-host';
import { WorkspaceDefaultsControls } from '@/app/board/_components/workspace-defaults-controls';
import { useBoardDefaultsBootstrap } from '@/app/board/_hooks/use-board-defaults-bootstrap';
import type { Project } from '@/app/projects/_services/projects.service.base';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import { WorkItemTypeBadge } from '@/app/work-items/_components/workItem-badge-type';
import { WorkItemFormDialog } from '@/app/work-items/_components/work-item-form-dialog';
import { DescriptionView } from '@/app/work-items/_components/workItem-description-view';
import { WorkItemsFilterDialog } from '@/app/work-items/_components/work-items-filter-dialog';
import {
  applyWorkItemsProjectSprintDraftToSearchParams,
  type WorkItemsFilterDraft,
} from '@/app/work-items/_components/workItems-table-helpers';
import type { FilterQuery } from '@/app/work-items/_components/workItems-table-types';
import { descriptionToPlainText } from '@/app/work-items/_helpers/work-item-description';
import { BOARD_STATUS_COLUMNS } from '@/app/work-items/_helpers/work-item-status';
import { updateWorkItemStatus } from '@/app/work-items/_services/workItem.service.client';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { SearchInput } from '@/components/search-input';
import { UserAvatar } from '@/components/user-avatar';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import {
  QUERY_FILTER_ALL_VALUE,
  useQueryFilter,
} from '@/hooks/use-query-filter';
import { tryHandleLockedMutationError } from '@/lib/optimistic-lock/run-locked-mutation';

type BoardStatus = Exclude<DbWorkItem['status'], 'Draft'>;

const COLUMNS = BOARD_STATUS_COLUMNS;

const MAX_VISIBLE_ASSIGNEES = 3;

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

type KanbanBoardProps = {
  readonly initialWorkItems: DbWorkItem[];
  readonly projects: Project[];
  readonly sprints: Sprint[];
  readonly projectFilter: string;
  readonly sprintFilter: string;
  readonly allowAllFilters: boolean;
  readonly userId: string | null;
  readonly suggestedDefaults: {
    readonly projectId: string;
    readonly sprintId: string | null;
  } | null;
  readonly needsClientBootstrap: boolean;
};

export function KanbanBoard({
  initialWorkItems,
  projects,
  sprints,
  projectFilter,
  sprintFilter,
  allowAllFilters,
  userId,
  suggestedDefaults,
  needsClientBootstrap,
}: Readonly<KanbanBoardProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { handleMutationError } = useOptimisticLock();
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
    suggestedDefaults,
  });
  const {
    savedDefaultsApplied,
    urlFiltersActive,
    openDefaultsDialog,
    resetUrlFilters,
  } = boardDefaults;

  const projectQuery = useQueryFilter('project', projectFilter);
  const sprintQuery = useQueryFilter('sprint', sprintFilter);
  const { setValue: setProjectFilterValue, allValue: projectAllValue } =
    projectQuery;
  const { setValue: setSprintFilterValue } = sprintQuery;

  const createProjects = useMemo(() => {
    if (!projectQuery.value || projectQuery.value === projectAllValue) {
      return projects;
    }
    return projects.filter((project) => project.id === projectQuery.value);
  }, [projectAllValue, projectQuery.value, projects]);

  const lockCreateProject =
    createProjects.length === 1 &&
    Boolean(projectQuery.value) &&
    projectQuery.value !== projectAllValue;

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [activeDropCol, setActiveDropCol] = useState<BoardStatus | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<DbWorkItem | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingStatusIds, setPendingStatusIds] = useState<Set<string>>(
    () => new Set()
  );

  const uniqueAssignees = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; name: string; profilePicture: string | null }
    >();

    for (const item of workItems) {
      if (item.assignee_id && item.assignee?.name) {
        byId.set(item.assignee_id, {
          id: item.assignee_id,
          name: item.assignee.name,
          profilePicture: item.assignee.profile_picture?.trim() || null,
        });
      }
    }

    return Array.from(byId.values());
  }, [workItems]);

  const visibleAssignees = uniqueAssignees.slice(0, MAX_VISIBLE_ASSIGNEES);
  const overflowAssignees = uniqueAssignees.slice(MAX_VISIBLE_ASSIGNEES);
  const isOverflowAssigneeSelected = overflowAssignees.some(
    (assignee) => assignee.id === assigneeFilter
  );

  const boardFilterFieldIds = useMemo(() => {
    const fields: Array<'project' | 'sprint' | 'priority'> = [];
    if (allowAllFilters) {
      fields.push('project');
    }
    fields.push('sprint', 'priority');
    return fields;
  }, [allowAllFilters]);

  const priorityQuery = useMemo<FilterQuery>(
    () => ({
      value: priorityFilter,
      setFilter: (value) => setPriorityFilter(value || QUERY_FILTER_ALL_VALUE),
      setValue: (value) => setPriorityFilter(value || QUERY_FILTER_ALL_VALUE),
      allValue: QUERY_FILTER_ALL_VALUE,
    }),
    [priorityFilter]
  );

  const toggleAssignee = (assigneeId: string) => {
    setAssigneeFilter((previous) =>
      previous === assigneeId ? null : assigneeId
    );
  };

  const hasLocalFilters =
    search.trim() !== '' ||
    priorityFilter !== QUERY_FILTER_ALL_VALUE ||
    assigneeFilter !== null;
  const hasActiveFilters = hasLocalFilters || urlFiltersActive;
  const hasDialogFilters =
    urlFiltersActive || priorityFilter !== QUERY_FILTER_ALL_VALUE;

  const handleApplyFilters = useCallback(
    (draft: WorkItemsFilterDraft) => {
      setPriorityFilter(
        !draft.priority || draft.priority === QUERY_FILTER_ALL_VALUE
          ? QUERY_FILTER_ALL_VALUE
          : draft.priority
      );

      const params = new URLSearchParams(searchParams.toString());

      if (allowAllFilters) {
        applyWorkItemsProjectSprintDraftToSearchParams(params, draft, {
          allValue: projectAllValue,
          applyProject: true,
        });
        if (!draft.project || draft.project === projectAllValue) {
          setProjectFilterValue(projectAllValue);
          setSprintFilterValue(sprintQuery.allValue);
        } else {
          setProjectFilterValue(draft.project);
          setSprintFilterValue(
            !draft.sprint || draft.sprint === projectAllValue
              ? sprintQuery.allValue
              : draft.sprint
          );
        }
      } else {
        applyWorkItemsProjectSprintDraftToSearchParams(params, draft, {
          allValue: sprintQuery.allValue,
          applyProject: false,
        });
        setSprintFilterValue(
          !draft.sprint || draft.sprint === sprintQuery.allValue
            ? sprintQuery.allValue
            : draft.sprint
        );
      }

      params.delete('page');
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [
      allowAllFilters,
      pathname,
      projectAllValue,
      router,
      searchParams,
      setProjectFilterValue,
      setSprintFilterValue,
      sprintQuery.allValue,
    ]
  );

  const handleClearFilters = () => {
    setSearch('');
    setPriorityFilter(QUERY_FILTER_ALL_VALUE);
    setAssigneeFilter(null);
    if (urlFiltersActive) {
      setProjectFilterValue(projectAllValue);
      setSprintFilterValue(sprintQuery.allValue);
      resetUrlFilters();
    }
  };

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return workItems.filter((item) => {
      if (item.status === 'Draft') {
        return false;
      }

      const description = descriptionToPlainText(item.description ?? null);
      const assignee = assigneeName(item).toLowerCase();

      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query) ||
        assignee.includes(query) ||
        item.type.toLowerCase().includes(query);

      const matchesPriority =
        priorityFilter === QUERY_FILTER_ALL_VALUE ||
        item.priority === priorityFilter;

      const matchesAssignee =
        !assigneeFilter || item.assignee_id === assigneeFilter;

      return matchesSearch && matchesPriority && matchesAssignee;
    });
  }, [workItems, search, priorityFilter, assigneeFilter]);

  const handleDragStart = (event: DragEvent, id: string) => {
    event.dataTransfer.setData('text/plain', id);
    setDraggedTaskId(id);
  };

  const handleDragOver = (event: DragEvent, colId: BoardStatus) => {
    event.preventDefault();
    if (activeDropCol !== colId) {
      setActiveDropCol(colId);
    }
  };

  const handleDragLeave = () => {
    setActiveDropCol(null);
  };

  const restoreStatus = (id: string, status: DbWorkItem['status']) => {
    setWorkItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, status } : item))
    );
    setSelectedTask((previous) =>
      previous?.id === id ? { ...previous, status } : previous
    );
  };

  const syncWorkItem = (id: string, updated: DbWorkItem) => {
    setWorkItems((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updated,
              assignee: updated.assignee ?? item.assignee,
            }
          : item
      )
    );
    setSelectedTask((previous) =>
      previous?.id === id
        ? {
            ...previous,
            ...updated,
            assignee: updated.assignee ?? previous.assignee,
          }
        : previous
    );
  };

  const clearPendingStatus = (id: string) => {
    setPendingStatusIds((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  };

  const reportStatusUpdateFailure = (error: unknown) => {
    let message: string;
    if (error instanceof Error && error.message.trim()) {
      message = error.message;
    } else if (typeof error === 'string' && error.trim()) {
      message = error;
    } else {
      message = 'Failed to update work item status.';
    }

    setStatusError(message);
  };

  const applyStatusChange = (id: string, targetStatus: BoardStatus) => {
    const currentItem = workItems.find((item) => item.id === id);
    if (!currentItem || currentItem.status === targetStatus) {
      return;
    }

    if (pendingStatusIds.has(id)) {
      return;
    }

    const previousStatus = currentItem.status;
    setStatusError(null);
    setPendingStatusIds((previous) => new Set(previous).add(id));
    restoreStatus(id, targetStatus);

    updateWorkItemStatus(id, targetStatus, currentItem.updated_at)
      .then((response) => {
        if (response.error || !response.data) {
          restoreStatus(id, previousStatus);
          reportStatusUpdateFailure(
            typeof response.error === 'string'
              ? response.error
              : 'Failed to update work item status.'
          );
          return;
        }

        syncWorkItem(id, response.data);
      })
      .catch(async (error) => {
        restoreStatus(id, previousStatus);
        if (
          await tryHandleLockedMutationError({
            error,
            handleMutationError,
            entityType: 'work_item',
            entityId: id,
            expectedUpdatedAt: currentItem.updated_at,
            pendingFields: { status: targetStatus },
            currentUserId: userId,
          })
        ) {
          return;
        }
        reportStatusUpdateFailure(error);
      })
      .finally(() => {
        clearPendingStatus(id);
      });
  };

  const handleDrop = (event: DragEvent, targetStatus: BoardStatus) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain') || draggedTaskId;
    if (id) {
      applyStatusChange(id, targetStatus);
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
        <div className="bg-destructive/10 text-destructive border-destructive/20 flex shrink-0 items-start gap-2 rounded-lg border px-3 py-2 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-1 items-start justify-between gap-3">
            <p>{statusError}</p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-destructive hover:text-destructive"
              onClick={() => setStatusError(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search work items..."
            className="sm:w-64"
          />

          <AvatarGroup
            className="*:data-[slot=avatar]:size-8"
            role="group"
            aria-label="Filter by assignee"
          >
            {visibleAssignees.map((assignee) => {
              const isSelected = assigneeFilter === assignee.id;
              return (
                <Tooltip key={assignee.id}>
                  <TooltipTrigger asChild>
                    <Avatar
                      size="default"
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`Filter by ${assignee.name}`}
                      className={cn(
                        'focus-visible:ring-ring cursor-pointer outline-none focus-visible:ring-2',
                        isSelected &&
                          'ring-primary ring-offset-background z-10 ring-2 ring-offset-2',
                        assigneeFilter && !isSelected && 'opacity-40'
                      )}
                      onClick={() => toggleAssignee(assignee.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleAssignee(assignee.id);
                        }
                      }}
                    >
                      {assignee.profilePicture ? (
                        <AvatarImage
                          src={assignee.profilePicture}
                          alt={assignee.name}
                        />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {getInitials(assignee.name)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {assignee.name}
                    {isSelected ? ' · filtering' : ''}
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {overflowAssignees.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <AvatarGroupCount
                    role="button"
                    tabIndex={0}
                    aria-label="Show more assignees"
                    className={cn(
                      'focus-visible:ring-ring cursor-pointer text-xs font-medium outline-none focus-visible:ring-2',
                      assigneeFilter &&
                        !isOverflowAssigneeSelected &&
                        'opacity-40',
                      isOverflowAssigneeSelected &&
                        'ring-primary ring-offset-background z-10 ring-2 ring-offset-2'
                    )}
                  >
                    +{overflowAssignees.length}
                  </AvatarGroupCount>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>More assignees</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {overflowAssignees.map((assignee) => (
                    <DropdownMenuCheckboxItem
                      key={assignee.id}
                      checked={assigneeFilter === assignee.id}
                      onCheckedChange={() => toggleAssignee(assignee.id)}
                    >
                      {assignee.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </AvatarGroup>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <WorkItemsFilterDialog
            projects={projects}
            projectMembers={[]}
            sprints={sprints}
            projectQuery={projectQuery}
            sprintQuery={sprintQuery}
            typeQuery={IDLE_FILTER_QUERY}
            assigneeQuery={IDLE_FILTER_QUERY}
            labelsQuery={IDLE_FILTER_QUERY}
            priorityQuery={priorityQuery}
            visibleFieldIds={boardFilterFieldIds}
            isProjectLocked={!allowAllFilters}
            isAssigneeLocked
            onApplyFilters={handleApplyFilters}
            hasActiveFilters={hasDialogFilters}
          />

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-muted-foreground hover:text-foreground h-9 px-3 text-xs"
            >
              Clear filters
              <X className="size-3.5" />
            </Button>
          ) : null}

          {userId ? (
            <WorkspaceDefaultsControls
              onOpenDefaultsDialog={openDefaultsDialog}
              savedDefaultsApplied={savedDefaultsApplied}
            />
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-1">
        {COLUMNS.map((column) => {
          const columnItems = filteredItems.filter(
            (item) => item.status === column.id
          );
          const isOver = activeDropCol === column.id;

          return (
            <section
              key={column.id}
              aria-label={formatLabelWithSpace(column.id)}
              className={cn(
                'bg-muted/25 flex h-full min-h-0 w-72 min-w-72 flex-1 flex-col rounded-xl border border-t-4 p-3 transition-colors',
                column.accentClassName,
                isOver && 'border-primary bg-primary/5 border-dashed'
              )}
              onDragOver={(event) => handleDragOver(event, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(event) => handleDrop(event, column.id)}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <WorkItemStatusBadge status={column.id} />
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary">{columnItems.length}</Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="cursor-pointer"
                        aria-label={`Create work item in ${formatLabelWithSpace(column.id)}`}
                        onClick={() => setCreateStatus(column.id)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Create in {formatLabelWithSpace(column.id)}
                    </TooltipContent>
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
                      const name = assigneeName(item);

                      return (
                        <Card
                          key={item.id}
                          draggable
                          onDragStart={(event) =>
                            handleDragStart(event, item.id)
                          }
                          onDragEnd={handleDragEnd}
                          onClick={() => {
                            setSelectedTask(item);
                            setIsDetailOpen(true);
                          }}
                          className={cn(
                            'group w-full max-w-full min-w-0 cursor-grab border border-b-[3px] py-0 shadow-sm active:cursor-grabbing',
                            (draggedTaskId === item.id ||
                              pendingStatusIds.has(item.id)) &&
                              'opacity-40'
                          )}
                        >
                          <CardContent className="flex min-w-0 flex-col gap-2 p-3.5">
                            <div className="flex items-start justify-between gap-2">
                              <TruncatedText className="text-foreground group-hover:text-primary min-w-0 flex-1 text-sm leading-snug font-semibold transition-colors">
                                {item.title}
                              </TruncatedText>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex shrink-0">
                                    <UserAvatar
                                      name={name}
                                      imageUrl={item.assignee?.profile_picture}
                                      title={name}
                                    />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  {name}
                                </TooltipContent>
                              </Tooltip>
                            </div>

                            {description ? (
                              <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                                {description}
                              </p>
                            ) : null}

                            <Separator className="my-1" />

                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <WorkItemTypeBadge
                                type={item.type}
                                className="max-w-full truncate"
                              />
                              <PriorityBadge priority={item.priority} />
                            </div>
                          </CardContent>
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

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
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
                  Preview this work item or move it between board columns.
                  Status changes are saved immediately.
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
                    {COLUMNS.map((column) => (
                      <Button
                        key={column.id}
                        type="button"
                        variant={
                          selectedTask.status === column.id
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        disabled={pendingStatusIds.has(selectedTask.id)}
                        onClick={() =>
                          applyStatusChange(selectedTask.id, column.id)
                        }
                      >
                        {formatLabelWithSpace(column.id)}
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

      <WorkItemFormDialog
        open={createStatus !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateStatus(null);
          }
        }}
        title="Create Work Item"
        description={
          createStatus
            ? `Create a work item in ${formatLabelWithSpace(createStatus)}.`
            : 'Create a work item.'
        }
        projects={
          lockCreateProject && createProjects[0] ? createProjects : projects
        }
        projectMembers={[]}
        lockProject={lockCreateProject}
        lockStatus={Boolean(createStatus)}
        defaultStatus={createStatus ?? undefined}
        defaultSprintId={
          sprintQuery.value && sprintQuery.value !== sprintQuery.allValue
            ? sprintQuery.value
            : null
        }
        onClose={() => setCreateStatus(null)}
        onSuccess={(created) => {
          setWorkItems((current) => [created, ...current]);
          setCreateStatus(null);
          router.refresh();
        }}
      />

      <WorkspaceDefaultsDialogHost
        enabled={Boolean(userId)}
        projects={projects}
        sprints={sprints}
        defaults={pickWorkspaceDefaultsDialogController(boardDefaults)}
      />
    </div>
  );
}
