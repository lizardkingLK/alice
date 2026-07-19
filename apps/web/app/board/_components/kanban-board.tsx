'use client';

import { useMemo, useState, type DragEvent } from 'react';
import { cn } from '@repo/ui/lib/utils';
import {
  AlertCircle,
  Calendar,
  Filter,
  FolderDot,
  HelpCircle,
  Info,
  Search,
  Tag,
  Trash2,
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
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';

type Status = 'ToDo' | 'InProgress' | 'Testing' | 'Done';
type Priority = 'low' | 'medium' | 'high';

type Task = {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assignee: string;
  category: string;
  dueDate: string;
};

function createTask(
  id: string,
  title: string,
  description: string,
  statusAndPriority: `${Status}:${Priority}`,
  assignee: string,
  category: string,
  dueDate: string
): Task {
  const [status, priority] = statusAndPriority.split(':') as [Status, Priority];
  return {
    id,
    title,
    description,
    status,
    priority,
    assignee,
    category,
    dueDate,
  };
}

const INITIAL_TASKS: Task[] = [
  createTask(
    'ALICE-101',
    'Integrate Supabase Auth',
    'Setup Supabase SSR authentication client and middleware for secure route protection.',
    'ToDo:high',
    'Alice Smith',
    'Security',
    '2026-07-20'
  ),
  createTask(
    'ALICE-104',
    'Design Landing Page Hero Section',
    'Implement modern glassmorphism aesthetic with floating particles and grid layout.',
    'ToDo:medium',
    'Bob Jones',
    'Design',
    '2026-07-25'
  ),
  createTask(
    'ALICE-102',
    'Create Reusable Table Component',
    'Build a generic table with sorting, search filtering, and paginated pagination state.',
    'InProgress:high',
    'Charlie Brown',
    'UI Components',
    '2026-07-18'
  ),
  createTask(
    'ALICE-105',
    'Write API Integration Tests',
    'Write robust integration test suites for project services and database operations.',
    'InProgress:low',
    'David Green',
    'QA / Testing',
    '2026-07-30'
  ),
  createTask(
    'ALICE-103',
    'Setup GitHub Actions CI Pipeline',
    'Setup standard GitHub actions workflow to run linters, typechecks, and tests automatically.',
    'Testing:high',
    'Alice Smith',
    'DevOps',
    '2026-07-16'
  ),
  createTask(
    'ALICE-100',
    'Monorepo Workspace Initialization',
    'Configure pnpm-workspace and turbo pipelines for web apps and packages packages.',
    'Done:medium',
    'Eve White',
    'Infrastructure',
    '2026-07-10'
  ),
];

const COLUMNS: {
  id: Status;
  accentClassName: string;
}[] = [
  {
    id: 'ToDo',
    accentClassName: 'border-t-violet-500',
  },
  {
    id: 'InProgress',
    accentClassName: 'border-t-amber-500',
  },
  {
    id: 'Testing',
    accentClassName: 'border-t-cyan-500',
  },
  {
    id: 'Done',
    accentClassName: 'border-t-emerald-500',
  },
];

const PRIORITY_BORDERS: Record<Priority, string> = {
  high: 'border-l-destructive',
  medium: 'border-l-primary',
  low: 'border-l-border',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function PriorityBadge({ priority }: { priority: Priority }) {
  switch (priority) {
    case 'high':
      return (
        <Badge variant="destructive" className="capitalize">
          <AlertCircle data-icon="inline-start" />
          High
        </Badge>
      );
    case 'medium':
      return (
        <Badge variant="default" className="capitalize">
          <Info data-icon="inline-start" />
          Medium
        </Badge>
      );
    case 'low':
      return (
        <Badge variant="secondary" className="capitalize">
          <HelpCircle data-icon="inline-start" />
          Low
        </Badge>
      );
  }
}

export function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [activeDropCol, setActiveDropCol] = useState<Status | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const uniqueAssignees = useMemo(
    () =>
      Array.from(
        new Set(
          tasks
            .map((task) => task.assignee)
            .filter((name) => name && name !== 'Unassigned')
        )
      ),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        task.id.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.assignee.toLowerCase().includes(query);

      const matchesPriority =
        priorityFilter === 'all' || task.priority === priorityFilter;

      const matchesAssignee =
        !assigneeFilter || task.assignee === assigneeFilter;

      return matchesSearch && matchesPriority && matchesAssignee;
    });
  }, [tasks, search, priorityFilter, assigneeFilter]);

  const handleDragStart = (event: DragEvent, id: string) => {
    event.dataTransfer.setData('text/plain', id);
    setDraggedTaskId(id);
  };

  const handleDragOver = (event: DragEvent, colId: Status) => {
    event.preventDefault();
    if (activeDropCol !== colId) {
      setActiveDropCol(colId);
    }
  };

  const handleDragLeave = () => {
    setActiveDropCol(null);
  };

  const handleDrop = (event: DragEvent, targetStatus: Status) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain') || draggedTaskId;
    if (id) {
      setTasks((previous) =>
        previous.map((task) =>
          task.id === id ? { ...task, status: targetStatus } : task
        )
      );
    }
    setDraggedTaskId(null);
    setActiveDropCol(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setActiveDropCol(null);
  };

  const moveTask = (taskId: string, targetStatus: Status) => {
    setTasks((previous) =>
      previous.map((task) =>
        task.id === taskId ? { ...task, status: targetStatus } : task
      )
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((previous) =>
        previous ? { ...previous, status: targetStatus } : null
      );
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((previous) => previous.filter((task) => task.id !== taskId));
    setIsDetailOpen(false);
    setSelectedTask(null);
  };

  return (
    <div className="flex h-full w-full flex-col gap-6">
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex w-full flex-1 flex-col gap-4 sm:flex-row sm:items-end">
            <div className="w-full space-y-2 sm:max-w-xs">
              <Label htmlFor="board-search">Search</Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  id="board-search"
                  placeholder="Search tasks, ids, assignees..."
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
                    const isSelected = assigneeFilter === assignee;
                    return (
                      <Tooltip key={assignee}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() =>
                              setAssigneeFilter((previous) =>
                                previous === assignee ? null : assignee
                              )
                            }
                            className={cn(
                              'focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2',
                              isSelected &&
                                'ring-primary ring-offset-background ring-2 ring-offset-2',
                              assigneeFilter && !isSelected && 'opacity-40'
                            )}
                            aria-pressed={isSelected}
                            aria-label={`Filter by ${assignee}`}
                          >
                            <Avatar size="default">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                {getInitials(assignee)}
                              </AvatarFallback>
                            </Avatar>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {assignee}
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
                          <p key={assignee}>{assignee}</p>
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
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-[32rem] flex-1 grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const columnTasks = filteredTasks.filter(
            (task) => task.status === column.id
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
                <Badge variant="secondary">{columnTasks.length}</Badge>
              </div>

              <ScrollArea className="h-0 min-h-0 flex-1 pr-2">
                <div className="flex flex-col gap-3 pb-1">
                  {columnTasks.length === 0 ? (
                    <div className="text-muted-foreground flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center text-xs">
                      <FolderDot className="text-muted-foreground/50 mb-2 size-8 stroke-1" />
                      No tasks in this stage
                    </div>
                  ) : (
                    columnTasks.map((task) => (
                      <Card
                        key={task.id}
                        draggable
                        onDragStart={(event) => handleDragStart(event, task.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => {
                          setSelectedTask(task);
                          setIsDetailOpen(true);
                        }}
                        className={cn(
                          'group cursor-grab rounded-l-none border-y-0 border-r-0 border-l-4 py-0 shadow-none active:cursor-grabbing',
                          PRIORITY_BORDERS[task.priority],
                          draggedTaskId === task.id && 'opacity-40'
                        )}
                      >
                        <CardContent className="flex flex-col gap-2 p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-muted-foreground font-mono text-[10px] font-medium tracking-wider uppercase">
                              {task.id}
                            </span>
                            <PriorityBadge priority={task.priority} />
                          </div>

                          <TruncatedText className="text-foreground group-hover:text-primary text-sm leading-snug font-semibold transition-colors">
                            {task.title}
                          </TruncatedText>

                          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                            {task.description}
                          </p>

                          <Separator className="my-1" />

                          <div className="flex items-center justify-between gap-2">
                            <Badge
                              variant="outline"
                              className="max-w-[60%] truncate"
                            >
                              <Tag data-icon="inline-start" />
                              <span className="truncate">{task.category}</span>
                            </Badge>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Avatar size="sm">
                                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                                    {getInitials(task.assignee)}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {task.assignee}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </CardContent>
                      </Card>
                    ))
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
                    {selectedTask.id}
                  </Badge>
                  <PriorityBadge priority={selectedTask.priority} />
                </div>
                <DialogTitle className="text-foreground text-xl">
                  {selectedTask.title}
                </DialogTitle>
                <DialogDescription>
                  Review details, update status, or remove this task from the
                  board.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Description
                  </p>
                  <p className="bg-muted/40 text-foreground rounded-lg border p-3 leading-relaxed">
                    {selectedTask.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/20 rounded-lg border p-3">
                    <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wide uppercase">
                      Assignee
                    </p>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-medium">
                          {getInitials(selectedTask.assignee)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-foreground text-xs font-medium">
                        {selectedTask.assignee}
                      </span>
                    </div>
                  </div>

                  <div className="bg-muted/20 rounded-lg border p-3">
                    <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wide uppercase">
                      Category
                    </p>
                    <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                      <Tag className="text-primary size-3.5" />
                      {selectedTask.category}
                    </span>
                  </div>

                  <div className="bg-muted/20 rounded-lg border p-3">
                    <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wide uppercase">
                      Due date
                    </p>
                    <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                      <Calendar className="text-primary size-3.5" />
                      {selectedTask.dueDate}
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
                        onClick={() => moveTask(selectedTask.id, column.id)}
                      >
                        {formatLabelWithSpace(column.id)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 border-t pt-4 sm:justify-between">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDeleteTask(selectedTask.id)}
                >
                  <Trash2 />
                  Delete task
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
