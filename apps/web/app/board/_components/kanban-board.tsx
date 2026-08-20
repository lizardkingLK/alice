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
  SquareArrowOutUpRight,
  X,
} from '@repo/ui/lib/icons';
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
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
import {
  buildSprintFilterOptionsForQuery,
  pushOptimisticProjectFilter,
} from '@/app/board/_services/board-defaults';
import type { Project } from '@/app/projects/_services/projects.service.base';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import { WorkItemTypeBadge } from '@/app/work-items/_components/workItem-badge-type';
import { DescriptionView } from '@/app/work-items/_components/workItem-description-view';
import { descriptionToPlainText } from '@/app/work-items/_helpers/work-item-description';
import { BOARD_STATUS_COLUMNS } from '@/app/work-items/_helpers/work-item-status';
import { PRIORITY_BORDER_STYLES } from '@/app/work-items/_helpers/work-item-priority-ui';
import { WORK_ITEM_PRIORITIES } from '@repo/types';
import { updateWorkItemStatus } from '@/app/work-items/_services/workItem.service.client';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { ListFilterSelect } from '@/components/list-filter-select';
import { SearchInput } from '@/components/search-input';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { useQueryFilter } from '@/hooks/use-query-filter';
import { tryHandleLockedMutationError } from '@/lib/optimistic-lock/run-locked-mutation';

type BoardStatus = Exclude<DbWorkItem['status'], 'Draft'>;
type BoardPriority = DbWorkItem['priority'];

const COLUMNS = BOARD_STATUS_COLUMNS;

const MAX_VISIBLE_ASSIGNEES = 3;

const PRIORITIES: BoardPriority[] = [...WORK_ITEM_PRIORITIES].reverse();

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

  const handleProjectChange = useCallback(
    (nextProject: string) => {
      pushOptimisticProjectFilter({
        searchParams,
        nextProject,
        sprints,
        allValue: projectAllValue,
        pageMode: 'delete',
        pathname,
        push: (href) => router.push(href),
        setProjectValue: setProjectFilterValue,
        setSprintValue: setSprintFilterValue,
      });
    },
    [
      pathname,
      projectAllValue,
      router,
      searchParams,
      setProjectFilterValue,
      setSprintFilterValue,
      sprints,
    ]
  );

  const sprintOptions = useMemo(
    () =>
      buildSprintFilterOptionsForQuery(
        sprints,
        projectQuery.value,
        projectAllValue
      ),
    [projectAllValue, projectQuery.value, sprints]
  );

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [activeDropCol, setActiveDropCol] = useState<BoardStatus | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<DbWorkItem | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingStatusIds, setPendingStatusIds] = useState<Set<string>>(
    () => new Set()
  );

  const uniqueAssignees = useMemo(() => {
    const byId = new Map<string, string>();

    for (const item of workItems) {
      if (item.assignee_id && item.assignee?.name) {
        byId.set(item.assignee_id, item.assignee.name);
      }
    }

    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
  }, [workItems]);

  const visibleAssignees = uniqueAssignees.slice(0, MAX_VISIBLE_ASSIGNEES);
  const overflowAssignees = uniqueAssignees.slice(MAX_VISIBLE_ASSIGNEES);
  const isOverflowAssigneeSelected = overflowAssignees.some(
    (assignee) => assignee.id === assigneeFilter
  );

  const handlePriorityChange = (value: string) => {
    setPriorityFilter(value || 'all');
  };

  const toggleAssignee = (assigneeId: string) => {
    setAssigneeFilter((previous) =>
      previous === assigneeId ? null : assigneeId
    );
  };

  const hasLocalFilters =
    search.trim() !== '' || priorityFilter !== 'all' || assigneeFilter !== null;
  const hasActiveFilters = hasLocalFilters || urlFiltersActive;

  const handleClearFilters = () => {
    setSearch('');
    setPriorityFilter('all');
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
        priorityFilter === 'all' || item.priority === priorityFilter;

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
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-6">
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

      <Card className="shrink-0 shadow-none">
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search work items..."
              className="sm:w-64"
            />

            <ListFilterSelect
              value={projectQuery.value}
              onValueChange={handleProjectChange}
              allValue={projectQuery.allValue}
              allLabel="All Projects"
              ariaLabel="Filter by project"
              placeholder="All Projects"
              showAllOption={allowAllFilters}
              triggerClassName="sm:w-44"
              options={projects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
            />

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

            <ListFilterSelect
              value={priorityFilter}
              onValueChange={handlePriorityChange}
              allValue="all"
              allLabel="All Priorities"
              ariaLabel="Filter by priority"
              placeholder="All Priorities"
              triggerClassName="sm:w-36"
              options={PRIORITIES.map((priority) => ({
                value: priority,
                label: formatLabelWithSpace(priority),
              }))}
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
          </div>

          <div className="flex items-center gap-3 lg:shrink-0">
            <AvatarGroup className="*:data-[slot=avatar]:size-8">
              {visibleAssignees.map((assignee) => {
                const isSelected = assigneeFilter === assignee.id;
                return (
                  <Tooltip key={assignee.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => toggleAssignee(assignee.id)}
                        className={cn(
                          'focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2',
                          isSelected &&
                            'ring-primary ring-offset-background ring-2 ring-offset-2',
                          assigneeFilter && !isSelected && 'opacity-40'
                        )}
                        aria-pressed={isSelected}
                        aria-label={`Filter by ${assignee.name}`}
                      >
                        <Avatar size="default">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                            {getInitials(assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                      </button>
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
                    <button
                      type="button"
                      className={cn(
                        'focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2',
                        assigneeFilter &&
                          !isOverflowAssigneeSelected &&
                          'opacity-40'
                      )}
                      aria-label="Show more assignees"
                    >
                      <AvatarGroupCount
                        className={cn(
                          'text-xs font-medium',
                          isOverflowAssigneeSelected &&
                            'ring-primary ring-offset-background ring-2 ring-offset-2'
                        )}
                      >
                        +{overflowAssignees.length}
                      </AvatarGroupCount>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
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

            {userId ? (
              <WorkspaceDefaultsControls
                onOpenDefaultsDialog={openDefaultsDialog}
                savedDefaultsApplied={savedDefaultsApplied}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                'bg-muted/25 flex h-full min-h-0 min-w-0 flex-col rounded-xl border border-t-4 p-3 transition-colors',
                column.accentClassName,
                isOver && 'border-primary bg-primary/5 border-dashed'
              )}
              onDragOver={(event) => handleDragOver(event, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(event) => handleDrop(event, column.id)}
            >
              <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <WorkItemStatusBadge status={column.id} />
                <Badge variant="secondary">{columnItems.length}</Badge>
              </div>

              <ScrollArea className="h-0 min-h-0 flex-1 pr-2">
                <div className="flex min-w-0 flex-col gap-3 pb-1">
                  {columnItems.length === 0 ? (
                    <div className="text-muted-foreground flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center text-xs">
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
                            'group min-w-0 cursor-grab rounded-l-none border-y-0 border-r-0 border-l-4 py-0 shadow-none active:cursor-grabbing',
                            PRIORITY_BORDER_STYLES[item.priority],
                            (draggedTaskId === item.id ||
                              pendingStatusIds.has(item.id)) &&
                              'opacity-40'
                          )}
                        >
                          <CardContent className="flex min-w-0 flex-col gap-2 p-3.5">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-muted-foreground font-mono text-[10px] font-medium tracking-wider uppercase">
                                {shortId(item.id)}
                              </span>
                              <PriorityBadge priority={item.priority} />
                            </div>

                            <TruncatedText className="text-foreground group-hover:text-primary w-full min-w-0 text-sm leading-snug font-semibold transition-colors">
                              {item.title}
                            </TruncatedText>

                            {description ? (
                              <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                                {description}
                              </p>
                            ) : null}

                            <Separator className="my-1" />

                            <div className="flex items-center justify-between gap-2">
                              <WorkItemTypeBadge
                                type={item.type}
                                className="max-w-[60%] truncate"
                              />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Avatar size="sm">
                                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                                      {getInitials(name)}
                                    </AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  {name}
                                </TooltipContent>
                              </Tooltip>
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

              <div className="min-w-0 space-y-4 text-sm">
                <div className="space-y-2">
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
                    <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wide uppercase">
                      Assignee
                    </p>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-medium">
                          {getInitials(assigneeName(selectedTask))}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-foreground text-xs font-medium">
                        {assigneeName(selectedTask)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-muted/20 rounded-lg border p-3">
                    <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wide uppercase">
                      Type
                    </p>
                    <WorkItemTypeBadge type={selectedTask.type} />
                  </div>

                  <div className="bg-muted/20 rounded-lg border p-3">
                    <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wide uppercase">
                      Due date
                    </p>
                    <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                      <Calendar className="text-primary size-3.5" />
                      {selectedTask.due_date ?? 'Not set'}
                    </span>
                  </div>

                  <div className="bg-muted/20 rounded-lg border p-3">
                    <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wide uppercase">
                      Status
                    </p>
                    <WorkItemStatusBadge status={selectedTask.status} />
                  </div>
                </div>

                <div className="space-y-2">
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

      <WorkspaceDefaultsDialogHost
        enabled={Boolean(userId)}
        projects={projects}
        sprints={sprints}
        defaults={pickWorkspaceDefaultsDialogController(boardDefaults)}
      />
    </div>
  );
}
