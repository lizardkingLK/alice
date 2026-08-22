'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Plus,
} from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
import type { Project } from '@/app/projects/_services/projects.service';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { User } from '@/app/users/_services/users.service';
import { toNameCase, WORK_ITEM_TYPES, WorkItemTypeEnum } from '@repo/types';
import { ALL_OPTION } from '@/app/_shared/values';
import { type CalendarActionItem } from './calendar-client.types';
import {
  applyCalendarFilterChange,
  CalendarFilterSelect,
} from './calendar-filter-controls';
import { MONTHS, DAYS_OF_WEEK } from './calendar-constants';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/components/ui/sheet';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui/components/ui/tabs';
import { WorkItemForm } from '@/app/work-items/_components/workItem-form';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import { WorkItemTypeBadge } from '@/app/work-items/_components/workItem-badge-type';
import { UserAvatar } from '@/components/user-avatar';
import { Pagination } from '@/components/pagination';

interface CalendarRegistryProps {
  readonly projects: Project[];
  readonly workItems: DbWorkItem[];
  readonly users: User[];
}

const toLocalYYYYMMDD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
};

let actionCounter = 0;

export function CalendarRegistry({
  projects,
  workItems,
  users,
}: Readonly<CalendarRegistryProps>) {
  const [localWorkItems, setLocalWorkItems] = useState(workItems);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('due');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    setLocalWorkItems(workItems);
  }, [workItems]);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  /** Set after mount so SSR/client "today" highlight stays in sync (TZ-safe). */
  const [todayDateString, setTodayDateString] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] =
    useState<string>(ALL_OPTION);
  const [selectedAssigneeId, setSelectedAssigneeId] =
    useState<string>(ALL_OPTION);
  const [selectedType, setSelectedType] = useState<string>(ALL_OPTION);

  useEffect(() => {
    setTodayDateString(toLocalYYYYMMDD(new Date()));
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const logAction = (action: CalendarActionItem) => {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `action-${Date.now()}-${++actionCounter}`;
    console.log('[Calendar Action Log]', {
      id,
      action,
      timestamp: new Date().toISOString(),
    });
  };

  const handleProjectChange = (val: string) => {
    applyCalendarFilterChange({
      value: val,
      setValue: setSelectedProjectId,
      actionType: 'filter_project',
      label: projects.find((p) => p.id === val)?.name ?? 'All Projects',
      logAction,
    });
  };

  const handleAssigneeChange = (val: string) => {
    applyCalendarFilterChange({
      value: val,
      setValue: setSelectedAssigneeId,
      actionType: 'filter_assignee',
      label: users.find((u) => u.id === val)?.name ?? 'All Assignees',
      logAction,
    });
  };

  const handleTypeChange = (val: string) => {
    applyCalendarFilterChange({
      value: val,
      setValue: setSelectedType,
      actionType: 'filter_type',
      label: val === ALL_OPTION ? 'All Types' : toNameCase(val),
      logAction,
    });
  };

  const handlePrevMonth = () => {
    const d = new Date(year, month - 1, 1);
    setCurrentDate(d);
    logAction({
      type: 'navigate_month',
      entity: { id: 'prev', value: d.toISOString(), label: 'Previous Month' },
    });
  };

  const handleNextMonth = () => {
    const d = new Date(year, month + 1, 1);
    setCurrentDate(d);
    logAction({
      type: 'navigate_month',
      entity: { id: 'next', value: d.toISOString(), label: 'Next Month' },
    });
  };

  const handleToday = () => {
    const d = new Date();
    const today = toLocalYYYYMMDD(d);
    setTodayDateString(today);
    setCurrentDate(d);
    logAction({
      type: 'navigate_month',
      entity: { id: 'today', value: d.toISOString(), label: 'Today' },
    });
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      dateString: string;
    }> = [];

    const pushDay = (
      d: Date,
      dayNum: number,
      isCurrentMonth: boolean
    ): void => {
      const dateString = toLocalYYYYMMDD(d);
      days.push({
        date: d,
        dayNum,
        isCurrentMonth,
        isToday: todayDateString !== null && dateString === todayDateString,
        dateString,
      });
    };

    // Previous month spacer days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      pushDay(d, daysInPrevMonth - i, false);
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      pushDay(new Date(year, month, i), i, true);
    }

    // Next month spacer days to complete a 42-cell grid
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      pushDay(new Date(year, month + 1, i), i, false);
    }

    return days;
  }, [year, month, todayDateString]);

  // Filtered work items
  const filteredWorkItems = useMemo(() => {
    return localWorkItems.filter(
      (item): item is DbWorkItem & { due_date: string } => {
        if (!item.due_date) return false;

        const matchesProject =
          selectedProjectId === ALL_OPTION ||
          item.project_id === selectedProjectId;
        const matchesAssignee =
          selectedAssigneeId === ALL_OPTION ||
          item.assignee_id === selectedAssigneeId;
        const matchesType =
          selectedType === ALL_OPTION || item.type === selectedType;

        return matchesProject && matchesAssignee && matchesType;
      }
    );
  }, [localWorkItems, selectedProjectId, selectedAssigneeId, selectedType]);

  // Group work items by due date string ("YYYY-MM-DD")
  const itemsByDate = useMemo(() => {
    const map: Record<string, DbWorkItem[]> = {};
    filteredWorkItems.forEach((item) => {
      if (item.due_date === null) {
        return;
      }
      const dateStr = item.due_date.split('T')[0] ?? '';
      if (!dateStr) {
        return;
      }
      map[dateStr] ??= [];
      map[dateStr].push(item);
    });
    return map;
  }, [filteredWorkItems]);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handlePrevMonth}
            className="size-8"
          >
            <ChevronLeft className="size-4" />
            <span className="sr-only">Previous Month</span>
          </Button>
          <h2 className="min-w-28 text-center text-base font-semibold tracking-tight sm:min-w-36 sm:text-lg">
            {MONTHS[month]} {year}
          </h2>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleNextMonth}
            className="size-8"
          >
            <ChevronRight className="size-4" />
            <span className="sr-only">Next Month</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="h-8 px-2.5 text-xs"
          >
            Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CalendarFilterSelect
            value={selectedProjectId}
            onValueChange={handleProjectChange}
            placeholder="Filter Project"
            allLabel="All Projects"
            options={projects.map((p) => ({ id: p.id, label: p.name }))}
          />

          <CalendarFilterSelect
            value={selectedAssigneeId}
            onValueChange={handleAssigneeChange}
            placeholder="Filter Assignee"
            allLabel="All Assignees"
            options={users.map((u) => ({ id: u.id, label: u.name }))}
          />

          <CalendarFilterSelect
            value={selectedType}
            onValueChange={handleTypeChange}
            placeholder="Filter Type"
            allLabel="All Types"
            triggerClassName="h-8 w-28 text-xs sm:w-32"
            options={WORK_ITEM_TYPES.map((workItemType) => ({
              id: workItemType,
              label: workItemType,
            }))}
          />
        </div>
      </div>

      <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
        <div className="bg-muted grid shrink-0 grid-cols-7 border-b">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="text-muted-foreground py-1.5 text-center text-[10px] font-semibold tracking-wider uppercase sm:text-xs"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="bg-border grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-px">
          {calendarDays.map((dayCell) => {
            const dayItems = itemsByDate[dayCell.dateString] || [];
            return (
              <button
                key={dayCell.dateString}
                type="button"
                onClick={() => {
                  setSelectedDateStr(dayCell.dateString);
                  setActiveTab('due');
                  setCurrentPage(1);
                  setPageSize(5);
                  logAction({
                    type: 'select_date',
                    entity: {
                      id: dayCell.dateString,
                      label: dayCell.dateString,
                    },
                  });
                }}
                className={cn(
                  'bg-card group hover:bg-accent/15 focus-visible:ring-ring flex h-full min-h-0 w-full cursor-pointer flex-col justify-between gap-1 overflow-hidden p-1.5 text-left outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-0 sm:p-2',
                  !dayCell.isCurrentMonth &&
                    'bg-muted/30 text-muted-foreground/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full text-[10px] font-bold select-none sm:size-6 sm:text-xs',
                      dayCell.isToday &&
                        'bg-primary text-primary-foreground font-extrabold shadow-sm',
                      !dayCell.isToday &&
                        'text-foreground/80 group-hover:text-foreground'
                    )}
                  >
                    {dayCell.dayNum}
                  </span>
                </div>

                {dayItems.length > 0 ? (
                  <div className="border-primary/25 bg-primary/5 text-primary flex min-w-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium shadow-xs sm:gap-1.5 sm:px-2 sm:text-[11px]">
                    <span className="bg-primary size-1 shrink-0 animate-pulse rounded-full sm:size-1.5" />
                    <span className="truncate">
                      {dayItems.length} item
                      {dayItems.length === 1 ? '' : 's'} due
                    </span>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sidebar Sheet */}
      <Sheet
        open={!!selectedDateStr}
        onOpenChange={(open) => !open && setSelectedDateStr(null)}
      >
        <SheetContent className="bg-card border-border/80 flex h-full flex-col p-0 data-[side=right]:sm:max-w-2xl">
          {selectedDateStr && (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              orientation="horizontal"
              className="flex h-full w-full min-w-0 flex-col"
            >
              <SheetHeader className="flex flex-row items-center justify-between gap-4 border-b p-6 pr-14 pb-4">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate text-xl font-bold">
                    {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString(
                      undefined,
                      { dateStyle: 'full' }
                    )}
                  </SheetTitle>
                  <SheetDescription className="text-muted-foreground truncate text-xs">
                    View work items due on this date or create a new one.
                  </SheetDescription>
                </div>
                <TabsList className="shrink-0">
                  <TabsTrigger value="due" className="gap-2">
                    <CheckSquare className="size-4 shrink-0" />
                    <span>
                      Due ({itemsByDate[selectedDateStr]?.length ?? 0})
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="create" className="gap-2">
                    <Plus className="size-4 shrink-0" />
                    <span>Create</span>
                  </TabsTrigger>
                </TabsList>
              </SheetHeader>
              <div className="no-scrollbar h-full min-h-0 w-full min-w-0 flex-1 overflow-y-auto p-6">
                <TabsContent
                  value="due"
                  className="mt-0 h-full w-full space-y-3 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  {(() => {
                    const dayItems = itemsByDate[selectedDateStr] || [];
                    if (dayItems.length === 0) {
                      return (
                        <div className="text-muted-foreground py-12 text-center text-sm">
                          No work items due on this date.
                        </div>
                      );
                    }

                    const totalCount = dayItems.length;
                    const totalPages = Math.ceil(totalCount / pageSize);
                    const paginatedItems = dayItems.slice(
                      (currentPage - 1) * pageSize,
                      currentPage * pageSize
                    );

                    return (
                      <div className="flex h-full flex-col justify-between gap-4">
                        <div className="w-full space-y-3">
                          {paginatedItems.map((item) => {
                            const isIssue =
                              item.type === WorkItemTypeEnum.Issue;
                            const isStory =
                              item.type === WorkItemTypeEnum.Story;
                            const projectKey =
                              item.project?.key ??
                              projects.find((p) => p.id === item.project_id)
                                ?.key ??
                              'ITEM';
                            const displayKey = `${projectKey}-${item.id.slice(-4)}`;

                            return (
                              <Link
                                key={item.id}
                                href={`/calendar/${item.id}`}
                                onClick={() =>
                                  logAction({
                                    type: 'view_item_details',
                                    entity: { id: item.id, label: item.title },
                                  })
                                }
                                className={cn(
                                  'border-border bg-card flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border p-3 shadow-sm transition-all duration-150 select-none',
                                  'hover:border-primary/30 hover:translate-x-0.5 hover:shadow-md',
                                  isIssue &&
                                    'border-red-500/20 bg-red-500/5 hover:bg-red-500/10',
                                  isStory &&
                                    'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10',
                                  !isIssue &&
                                    !isStory &&
                                    'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10'
                                )}
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <WorkItemTypeBadge type={item.type} compact />
                                  <span className="text-muted-foreground shrink-0 font-mono text-xs font-semibold">
                                    {displayKey}
                                  </span>
                                  <span className="text-foreground truncate text-sm font-medium">
                                    {item.title}
                                  </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <WorkItemStatusBadge status={item.status} />
                                  <PriorityBadge priority={item.priority} />
                                  <UserAvatar
                                    name={item.assignee?.name}
                                    imageUrl={item.assignee?.profile_picture}
                                    title={item.assignee?.name ?? 'Unassigned'}
                                  />
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                        {totalCount > 0 && (
                          <Pagination
                            totalCount={totalCount}
                            page={currentPage}
                            limit={pageSize}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            onLimitChange={setPageSize}
                            label="work items"
                          />
                        )}
                      </div>
                    );
                  })()}
                </TabsContent>
                <TabsContent
                  value="create"
                  className="mt-0 w-full outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  <WorkItemForm
                    projects={projects}
                    projectMembers={users}
                    onSuccess={(newWI) => {
                      setLocalWorkItems((prev) => [newWI, ...prev]);
                      setActiveTab('due');
                      setCurrentPage(1);
                      setPageSize(5);
                    }}
                  />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
