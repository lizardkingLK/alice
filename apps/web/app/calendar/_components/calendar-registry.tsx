'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckSquare,
  BookOpen,
  AlertCircle,
} from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@repo/ui/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { cn } from '@repo/ui/lib/utils';
import type { Project } from '@/app/projects/_services/projects.service';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { User } from '@/app/users/_services/users.service';
import { toNameCase } from '@repo/types';
import { ALL_OPTION } from '@/app/_shared/values';
import {
  type CalendarActionItem,
  CalendarWorkItemTypes,
} from './calendar-client.types';
import { MONTHS, DAYS_OF_WEEK } from './calendar-constants';

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
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedProjectId, setSelectedProjectId] =
    useState<string>(ALL_OPTION);
  const [selectedAssigneeId, setSelectedAssigneeId] =
    useState<string>(ALL_OPTION);
  const [selectedType, setSelectedType] = useState<string>(ALL_OPTION);

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
    setSelectedProjectId(val);
    logAction({
      type: 'filter_project',
      entity: {
        id: val,
        value: val,
        label: projects.find((p) => p.id === val)?.name ?? 'All Projects',
      },
    });
  };

  const handleAssigneeChange = (val: string) => {
    setSelectedAssigneeId(val);
    logAction({
      type: 'filter_assignee',
      entity: {
        id: val,
        value: val,
        label: users.find((u) => u.id === val)?.name ?? 'All Assignees',
      },
    });
  };

  const handleTypeChange = (val: string) => {
    setSelectedType(val);
    logAction({
      type: 'filter_type',
      entity: {
        id: val,
        value: val,
        label: val === ALL_OPTION ? 'All Types' : toNameCase(val),
      },
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

    const today = new Date();

    // Previous month spacer days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({
        date: d,
        dayNum: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: d.toDateString() === today.toDateString(),
        dateString: toLocalYYYYMMDD(d),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d,
        dayNum: i,
        isCurrentMonth: true,
        isToday: d.toDateString() === today.toDateString(),
        dateString: toLocalYYYYMMDD(d),
      });
    }

    // Next month spacer days to complete a 42-cell grid
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        dayNum: i,
        isCurrentMonth: false,
        isToday: d.toDateString() === today.toDateString(),
        dateString: toLocalYYYYMMDD(d),
      });
    }

    return days;
  }, [year, month]);

  // Filtered work items
  const filteredWorkItems = useMemo(() => {
    return workItems.filter(
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
  }, [workItems, selectedProjectId, selectedAssigneeId, selectedType]);

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
      if (!map[dateStr]) {
        map[dateStr] = [];
      }
      map[dateStr].push(item);
    });
    return map;
  }, [filteredWorkItems]);

  return (
    <div className="space-y-6 p-6">
      {/* Filters & Header Bar */}
      <Card className="border-border bg-card shadow-md">
        <CardHeader className="flex flex-col space-y-4 border-b pb-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="text-primary h-6 w-6" />
              <CardTitle className="text-2xl font-bold tracking-tight">
                Calendar
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground mt-1">
              Visualize schedules and track upcoming milestones for tasks,
              stories, and bugs.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Project Filter */}
            <div className="w-40">
              <Select
                value={selectedProjectId}
                onValueChange={handleProjectChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_OPTION}>All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee Filter */}
            <div className="w-40">
              <Select
                value={selectedAssigneeId}
                onValueChange={handleAssigneeChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_OPTION}>All Assignees</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="w-35">
              <Select value={selectedType} onValueChange={handleTypeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_OPTION}>All Types</SelectItem>
                  <SelectItem value={CalendarWorkItemTypes.Epic}>
                    Epic
                  </SelectItem>
                  <SelectItem value={CalendarWorkItemTypes.Story}>
                    Story
                  </SelectItem>
                  <SelectItem value={CalendarWorkItemTypes.Task}>
                    Task
                  </SelectItem>
                  <SelectItem value={CalendarWorkItemTypes.Issue}>
                    Issue
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Calendar Controller */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevMonth}
                className="h-9 w-9"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Previous Month</span>
              </Button>
              <h2 className="min-w-35 text-center text-xl font-semibold">
                {MONTHS[month]} {year}
              </h2>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextMonth}
                className="h-9 w-9"
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Next Month</span>
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="px-3 py-1 text-sm font-medium"
            >
              Today
            </Button>
          </div>

          {/* Days of Week Header */}
          <div className="bg-border grid grid-cols-7 gap-px overflow-hidden rounded-t-lg border-x border-t">
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                className="bg-muted text-muted-foreground py-2 text-center text-xs font-semibold tracking-wider uppercase"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="bg-border grid grid-cols-7 gap-px overflow-hidden rounded-b-lg border">
            {calendarDays.map((dayCell) => {
              const dayItems = itemsByDate[dayCell.dateString] || [];
              return (
                <div
                  key={dayCell.dateString}
                  className={cn(
                    'bg-card group hover:bg-accent/10 flex min-h-30 flex-col justify-between p-2 transition-colors duration-150',
                    !dayCell.isCurrentMonth &&
                      'bg-muted/30 text-muted-foreground/50'
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold select-none',
                        dayCell.isToday &&
                          'bg-primary text-primary-foreground font-extrabold shadow-sm',
                        !dayCell.isToday &&
                          'text-foreground/80 group-hover:text-foreground'
                      )}
                    >
                      {dayCell.dayNum}
                    </span>
                  </div>

                  <div className="flex max-h-20 flex-1 scrollbar-thin flex-col gap-1 overflow-y-auto">
                    {dayItems.map((item) => {
                      const isIssue = item.type === CalendarWorkItemTypes.Issue;
                      const isStory = item.type === CalendarWorkItemTypes.Story;

                      let itemIcon = (
                        <CheckSquare className="h-3 w-3 shrink-0" />
                      );
                      if (isIssue) {
                        itemIcon = <AlertCircle className="h-3 w-3 shrink-0" />;
                      } else if (isStory) {
                        itemIcon = <BookOpen className="h-3 w-3 shrink-0" />;
                      }

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
                            'flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition-all duration-150',
                            'hover:translate-x-0.5 hover:shadow-xs',
                            isIssue &&
                              'border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-400',
                            isStory &&
                              'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400',
                            !isIssue &&
                              !isStory &&
                              'border-blue-500/30 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 dark:text-blue-400'
                          )}
                          title={`${toNameCase(item.type)} - ${item.title}`}
                        >
                          {itemIcon}
                          <span className="truncate">{item.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
