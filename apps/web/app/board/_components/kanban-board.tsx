'use client';

import { useMemo, useState, type DragEvent } from 'react';
import { cn } from '@repo/ui/lib/utils';
import {
  AlertCircle,
  Calendar,
  Filter,
  FolderDot,
  Search,
  SquareArrowOutUpRight,
  Tag,
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
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Separator } from '@repo/ui/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { formatLabelWithSpace } from '@/app/_shared/utility';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import { DescriptionView } from '@/app/work-items/_components/workItem-description-view';
import { descriptionToPlainText } from '@/app/work-items/_helpers/work-item-description';
import { updateWorkItemStatus } from '@/app/work-items/_services/workItem.client.service';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.server.service';

type BoardStatus = Exclude<DbWorkItem['status'], 'Draft'>;
type BoardPriority = DbWorkItem['priority'];

const COLUMNS: {
  id: BoardStatus;
  accentClassName: string;
}[] = [
  { id: 'New', accentClassName: 'border-t-blue-500' },
  { id: 'ToDo', accentClassName: 'border-t-violet-500' },
  { id: 'InProgress', accentClassName: 'border-t-amber-500' },
  { id: 'Testing', accentClassName: 'border-t-cyan-500' },
  { id: 'Done', accentClassName: 'border-t-emerald-500' },
];

const PRIORITY_BORDERS: Record<BoardPriority, string> = {
  highest: 'border-l-destructive',
  high: 'border-l-destructive',
  medium: 'border-l-primary',
  low: 'border-l-border',
  lowest: 'border-l-border',
};

const PRIORITIES: BoardPriority[] = [
  'highest',
  'high',
  'medium',
  'low',
  'lowest',
];

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function assigneeName(item: DbWorkItem) {
  return item.assignee?.name?.trim() || 'Unassigned';
}

type KanbanBoardProps = {
  initialWorkItems: DbWorkItem[];
};

export function KanbanBoard({ initialWorkItems }: Readonly<KanbanBoardProps>) {
  const [workItems, setWorkItems] = useState<DbWorkItem[]>(initialWorkItems);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
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

    updateWorkItemStatus(id, targetStatus)
      .then((response) => {
        if (response.error || !response.data) {
          restoreStatus(id, previousStatus);
          setStatusError(
            typeof response.error === 'string'
              ? response.error
              : 'Failed to update work item status.'
          );
          return;
        }

        syncWorkItem(id, response.data);
      })
      .catch(() => {
        restoreStatus(id, previousStatus);
        setStatusError('Failed to update work item status.');
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
    <div className="flex h-full w-full flex-col gap-6">
      {statusError ? (
        <div className="bg-destructive/10 text-destructive border-destructive/20 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
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

      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex w-full flex-1 flex-col gap-4 sm:flex-row sm:items-end">
            <div className="w-full space-y-2 sm:max-w-xs">
              <Label htmlFor="board-search">Search</Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  id="board-search"
                  placeholder="Search work items..."
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assignees</Label>
              <div className="flex items-center gap-2">
                <AvatarGroup className="*:data-[slot=avatar]:size-8">
                  {uniqueAssignees.slice(0, 3).map((assignee) => {
                    const isSelected = assigneeFilter === assignee.id;
                    return (
                      <Tooltip key={assignee.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() =>
                              setAssigneeFilter((previous) =>
                                previous === assignee.id ? null : assignee.id
                              )
                            }
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
                  {uniqueAssignees.length > 3 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AvatarGroupCount className="text-xs font-medium">
                          +{uniqueAssignees.length - 3}
                        </AvatarGroupCount>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="space-y-1">
                        {uniqueAssignees.slice(3).map((assignee) => (
                          <p key={assignee.id}>{assignee.name}</p>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </AvatarGroup>

                {assigneeFilter ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAssigneeFilter(null)}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="w-full space-y-2 md:w-48">
            <Label htmlFor="board-priority">Priority</Label>
            <div className="flex items-center gap-2">
              <Filter className="text-muted-foreground size-4 shrink-0" />
              <Select
                value={priorityFilter}
                onValueChange={(value) => {
                  if (value) {
                    setPriorityFilter(value);
                  }
                }}
              >
                <SelectTrigger id="board-priority" className="w-full">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {formatLabelWithSpace(priority)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-[32rem] flex-1 grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                'bg-muted/25 flex h-full min-h-[32rem] flex-col rounded-xl border border-t-4 p-3 transition-colors',
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
                <div className="flex flex-col gap-3 pb-1">
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
                            'group cursor-grab rounded-l-none border-y-0 border-r-0 border-l-4 py-0 shadow-none active:cursor-grabbing',
                            PRIORITY_BORDERS[item.priority],
                            (draggedTaskId === item.id ||
                              pendingStatusIds.has(item.id)) &&
                              'opacity-40'
                          )}
                        >
                          <CardContent className="flex flex-col gap-2 p-3.5">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-muted-foreground font-mono text-[10px] font-medium tracking-wider uppercase">
                                {shortId(item.id)}
                              </span>
                              <PriorityBadge priority={item.priority} />
                            </div>

                            <TruncatedText className="text-foreground group-hover:text-primary text-sm leading-snug font-semibold transition-colors">
                              {item.title}
                            </TruncatedText>

                            {description ? (
                              <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                                {description}
                              </p>
                            ) : null}

                            <Separator className="my-1" />

                            <div className="flex items-center justify-between gap-2">
                              <Badge
                                variant="outline"
                                className="max-w-[60%] truncate"
                              >
                                <Tag data-icon="inline-start" />
                                <span className="truncate">{item.type}</span>
                              </Badge>
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
        <DialogContent className="sm:max-w-xl">
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

              <div className="space-y-4 text-sm">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Description
                  </p>
                  <div className="bg-muted/40 max-h-56 overflow-y-auto rounded-lg border p-3">
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
                    <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                      <Tag className="text-primary size-3.5" />
                      {selectedTask.type}
                    </span>
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
    </div>
  );
}
