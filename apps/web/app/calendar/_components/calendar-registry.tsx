'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, ListTodo } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  pickWorkspaceDefaultsDialogController,
  WorkspaceDefaultsDialogHost,
} from '@/app/board/_components/workspace-defaults-dialog-host';
import { useBoardDefaultsBootstrap } from '@/app/board/_hooks/use-board-defaults-bootstrap';
import {
  applyProjectFilterToSearchParams,
  buildSprintFilterOptionsForQuery,
} from '@/app/board/_services/board.defaults.shared';
import type { Project } from '@/app/projects/_services/projects.mutations.client';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import type { User } from '@/app/users/_services/users.mutations.client';
import { toNameCase, WORK_ITEM_TYPES } from '@repo/types';
import { ALL_OPTION } from '@/app/_shared/values';
import { type CalendarActionItem } from './calendar-client.types';
import {
  applyCalendarFilterChange,
  CalendarFilterSelect,
} from './calendar-filter-controls';
import { MONTHS } from './calendar-constants';
import { WorkItemFormDialog } from '@/app/work-items/_components/work-item-form/work-item-form-dialog';
import {
  QUERY_FILTER_ALL_VALUE,
  useQueryFilter,
} from '@/hooks/use-query-filter';
import { CalendarDaySheet } from '@/app/calendar/_components/calendar-day-sheet';
import { CalendarDueDateWarningDialog } from '@/app/calendar/_components/calendar-due-date-warning-dialog';
import { CalendarMonthGrid } from '@/app/calendar/_components/calendar-month-grid';
import { CalendarUnscheduledPanel } from '@/app/calendar/_components/calendar-unscheduled-panel';
import { useCalendarDueDateDrag } from '@/app/calendar/_components/use-calendar-due-date-drag';
import {
  readCalendarUnscheduledPanelOpen,
  writeCalendarUnscheduledPanelOpen,
} from '@/app/calendar/_helpers/calendar-unscheduled-panel-storage';
import {
  buildCalendarDays,
  filterCalendarWorkItems,
  filterUnscheduledWorkItems,
  groupWorkItemsByDueDate,
  toLocalYYYYMMDD,
} from '@/app/calendar/_components/calendar-utils';

interface CalendarRegistryProps {
  readonly projects: Project[];
  readonly sprints: Sprint[];
  readonly workItems: DbWorkItem[];
  readonly users: User[];
  readonly projectFilter: string;
  readonly sprintFilter: string;
  readonly allowAllFilters: boolean;
  readonly userId: string | null;
  readonly suggestedDefaults: {
    readonly projectId: string;
    readonly sprintId: string | null;
  } | null;
  readonly needsClientBootstrap: boolean;
}

let actionCounter = 0;

export function CalendarRegistry({
  projects,
  sprints,
  workItems,
  users,
  projectFilter,
  sprintFilter,
  allowAllFilters,
  userId,
  suggestedDefaults,
  needsClientBootstrap,
}: Readonly<CalendarRegistryProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [localWorkItems, setLocalWorkItems] = useState(workItems);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [itemToEdit, setItemToEdit] = useState<DbWorkItem | null>(null);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [todayDateString, setTodayDateString] = useState<string | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] =
    useState<string>(ALL_OPTION);
  const [selectedType, setSelectedType] = useState<string>(ALL_OPTION);
  const [showUnscheduledPanel, setShowUnscheduledPanel] = useState(false);
  const suppressDaySheetCloseRef = useRef(false);

  const projectQuery = useQueryFilter('project', projectFilter);
  const sprintQuery = useQueryFilter('sprint', sprintFilter);

  const boardDefaults = useBoardDefaultsBootstrap({
    userId,
    needsClientBootstrap,
    projectFilter,
    sprintFilter,
    projects,
    sprints,
    suggestedDefaults,
  });

  const dueDateDrag = useCalendarDueDateDrag({
    localWorkItems,
    setLocalWorkItems,
    setItemToEdit,
    userId,
  });

  useEffect(() => {
    setLocalWorkItems(workItems);
  }, [workItems]);

  useEffect(() => {
    setTodayDateString(toLocalYYYYMMDD(new Date()));
  }, []);

  useEffect(() => {
    setShowUnscheduledPanel(readCalendarUnscheduledPanelOpen(userId));
  }, [userId]);

  const setUnscheduledPanelOpen = useCallback(
    (next: boolean) => {
      setShowUnscheduledPanel(next);
      writeCalendarUnscheduledPanelOpen(userId, next);
    },
    [userId]
  );

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

  const handleProjectChange = useCallback(
    (val: string) => {
      const params = new URLSearchParams(searchParams.toString());
      applyProjectFilterToSearchParams(params, {
        nextProject: val,
        sprints,
        pageMode: 'delete',
      });
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
      logAction({
        type: 'filter_project',
        entity: {
          id: val,
          value: val,
          label: projects.find((p) => p.id === val)?.name ?? 'All Projects',
        },
      });
    },
    [pathname, projects, router, searchParams, sprints]
  );

  const handleSprintChange = (val: string) => {
    sprintQuery.setFilter(val);
    logAction({
      type: 'filter_project',
      entity: {
        id: val,
        value: val,
        label: sprints.find((s) => s.id === val)?.name ?? 'All Sprints',
      },
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

  const openEditDialog = (item: DbWorkItem) => {
    if (dueDateDrag.shouldSuppressItemClick()) {
      return;
    }
    setItemToEdit(item);
    logAction({
      type: 'view_item_details',
      entity: { id: item.id, label: item.title },
    });
  };

  const openDaySheet = (dateString: string) => {
    if (dueDateDrag.draggedItemId) {
      return;
    }
    setSelectedDateStr(dateString);
    logAction({
      type: 'select_date',
      entity: { id: dateString, label: dateString },
    });
  };

  const handleDaySheetOpenChange = useCallback((open: boolean) => {
    if (open || suppressDaySheetCloseRef.current) {
      return;
    }
    setSelectedDateStr(null);
  }, []);

  const closeEditDialog = useCallback(() => {
    suppressDaySheetCloseRef.current = true;
    setItemToEdit(null);
    queueMicrotask(() => {
      suppressDaySheetCloseRef.current = false;
    });
  }, []);

  const handleEditDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        return;
      }
      closeEditDialog();
    },
    [closeEditDialog]
  );

  const navigateMonth = (direction: 'prev' | 'next' | 'today') => {
    let d: Date;
    let id: 'prev' | 'next' | 'today';
    let label: string;

    if (direction === 'today') {
      d = new Date();
      setTodayDateString(toLocalYYYYMMDD(d));
      id = 'today';
      label = 'Today';
    } else if (direction === 'prev') {
      d = new Date(year, month - 1, 1);
      id = 'prev';
      label = 'Previous Month';
    } else {
      d = new Date(year, month + 1, 1);
      id = 'next';
      label = 'Next Month';
    }

    setCurrentDate(d);
    logAction({
      type: 'navigate_month',
      entity: { id, value: d.toISOString(), label },
    });
  };

  const sprintOptions = useMemo(
    () =>
      buildSprintFilterOptionsForQuery(
        sprints,
        projectQuery.value,
        QUERY_FILTER_ALL_VALUE
      ),
    [projectQuery.value, sprints]
  );

  const projectSelectOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, label: p.name })),
    [projects]
  );

  const calendarDays = useMemo(
    () => buildCalendarDays(year, month, todayDateString),
    [year, month, todayDateString]
  );

  const calendarFilterOptions = useMemo(
    () => ({
      projectValue: projectQuery.value,
      sprintValue: sprintQuery.value,
      assigneeId: selectedAssigneeId,
      type: selectedType,
    }),
    [projectQuery.value, sprintQuery.value, selectedAssigneeId, selectedType]
  );

  const filteredWorkItems = useMemo(
    () => filterCalendarWorkItems(localWorkItems, calendarFilterOptions),
    [localWorkItems, calendarFilterOptions]
  );

  const itemsByDate = useMemo(
    () => groupWorkItemsByDueDate(filteredWorkItems),
    [filteredWorkItems]
  );

  const unscheduledWorkItems = useMemo(
    () => filterUnscheduledWorkItems(localWorkItems, calendarFilterOptions),
    [localWorkItems, calendarFilterOptions]
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => navigateMonth('prev')}
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
            onClick={() => navigateMonth('next')}
            className="size-8"
          >
            <ChevronRight className="size-4" />
            <span className="sr-only">Next Month</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('today')}
            className="h-8 px-2.5 text-xs"
          >
            Today
          </Button>
          <Button
            variant={showUnscheduledPanel ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={showUnscheduledPanel}
            onClick={() => setUnscheduledPanelOpen(!showUnscheduledPanel)}
            className="h-8 gap-1.5 px-2.5 text-xs"
          >
            <ListTodo className="size-4 shrink-0" />
            <span className="hidden sm:inline">Unscheduled</span>
            {unscheduledWorkItems.length > 0 ? (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                {unscheduledWorkItems.length}
              </span>
            ) : null}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CalendarFilterSelect
            value={projectQuery.value || QUERY_FILTER_ALL_VALUE}
            onValueChange={handleProjectChange}
            placeholder="Filter Project"
            allLabel="All Projects"
            options={projectSelectOptions}
            includeAll={allowAllFilters}
          />
          <CalendarFilterSelect
            value={sprintQuery.value || QUERY_FILTER_ALL_VALUE}
            onValueChange={handleSprintChange}
            placeholder="Filter Sprint"
            allLabel="All Sprints"
            options={sprintOptions.map((option) => ({
              id: option.value,
              label: option.label,
            }))}
            includeAll={allowAllFilters}
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

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <CalendarMonthGrid
          className="min-h-0 flex-1"
          calendarDays={calendarDays}
          itemsByDate={itemsByDate}
          projects={projects}
          activeDropDate={dueDateDrag.activeDropDate}
          draggedItemId={dueDateDrag.draggedItemId}
          pendingDueDateIds={dueDateDrag.pendingDueDateIds}
          onOpenDay={openDaySheet}
          onItemDragStart={dueDateDrag.handleItemDragStart}
          onItemDragEnd={dueDateDrag.handleItemDragEnd}
          onDayDragOver={dueDateDrag.handleDayDragOver}
          onDayDragLeave={dueDateDrag.handleDayDragLeave}
          onDayDrop={dueDateDrag.handleDayDrop}
          onOpenItem={openEditDialog}
        />
        {showUnscheduledPanel ? (
          <CalendarUnscheduledPanel
            className="min-h-48 w-full shrink-0 lg:min-h-0 lg:w-[28rem] xl:w-[32rem]"
            items={unscheduledWorkItems}
            projects={projects}
            draggedItemId={dueDateDrag.draggedItemId}
            pendingDueDateIds={dueDateDrag.pendingDueDateIds}
            onClose={() => setUnscheduledPanelOpen(false)}
            onDragStart={dueDateDrag.handleItemDragStart}
            onDragEnd={dueDateDrag.handleItemDragEnd}
            onOpenItem={openEditDialog}
          />
        ) : null}
      </div>

      <CalendarDaySheet
        key={selectedDateStr ?? 'closed'}
        selectedDateStr={selectedDateStr}
        blockOutsideClose={itemToEdit !== null}
        onOpenChange={handleDaySheetOpenChange}
        itemsByDate={itemsByDate}
        projects={projects}
        users={users}
        projectValue={projectQuery.value}
        sprintValue={sprintQuery.value}
        onOpenItem={openEditDialog}
        onCreated={(newWI) => {
          setLocalWorkItems((prev) => [newWI, ...prev]);
        }}
      />

      <WorkItemFormDialog
        open={itemToEdit !== null}
        onOpenChange={handleEditDialogOpenChange}
        title="Edit Work Item"
        description="Update the details for this work item."
        projects={projects}
        projectMembers={users}
        itemToEdit={itemToEdit}
        onClose={closeEditDialog}
        onSuccess={(updated) => {
          setLocalWorkItems((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );
          closeEditDialog();
          router.refresh();
        }}
      />

      <WorkspaceDefaultsDialogHost
        enabled={Boolean(userId)}
        projects={projects}
        sprints={sprints}
        defaults={pickWorkspaceDefaultsDialogController(boardDefaults)}
      />

      <CalendarDueDateWarningDialog
        open={dueDateDrag.dueDateWarningOpen}
        message={dueDateDrag.dueDateWarning}
        onClose={dueDateDrag.closeDueDateWarning}
      />
    </div>
  );
}
