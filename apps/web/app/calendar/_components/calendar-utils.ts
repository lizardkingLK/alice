import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { toLocalYYYYMMDD } from '@/app/_shared/utility';
import { ALL_OPTION } from '@/app/_shared/values';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';

export { toLocalYYYYMMDD };

export const PAST_DUE_DATE_MESSAGE = 'Due date must be on or after today';

export type CalendarDayCell = {
  readonly date: Date;
  readonly dayNum: number;
  readonly isCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly dateString: string;
};

export function buildCalendarDays(
  year: number,
  month: number,
  todayDateString: string | null
): CalendarDayCell[] {
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: CalendarDayCell[] = [];

  const pushDay = (d: Date, dayNum: number, isCurrentMonth: boolean): void => {
    const dateString = toLocalYYYYMMDD(d);
    days.push({
      date: d,
      dayNum,
      isCurrentMonth,
      isToday: todayDateString !== null && dateString === todayDateString,
      dateString,
    });
  };

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrevMonth - i);
    pushDay(d, daysInPrevMonth - i, false);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    pushDay(new Date(year, month, i), i, true);
  }

  const remainingSlots = 42 - days.length;
  for (let i = 1; i <= remainingSlots; i++) {
    pushDay(new Date(year, month + 1, i), i, false);
  }

  return days;
}

export function filterCalendarWorkItems(
  items: readonly DbWorkItem[],
  options: CalendarFilterOptions
): Array<DbWorkItem & { due_date: string }> {
  return items.filter((item): item is DbWorkItem & { due_date: string } => {
    if (!item.due_date) {
      return false;
    }
    return matchesCalendarFilters(item, options);
  });
}

/** Work items with no due date that match the active calendar filters. */
export function filterUnscheduledWorkItems(
  items: readonly DbWorkItem[],
  options: CalendarFilterOptions
): DbWorkItem[] {
  return items.filter(
    (item) => item.due_date === null && matchesCalendarFilters(item, options)
  );
}

export type CalendarFilterOptions = {
  readonly projectValue: string;
  readonly sprintValue: string;
  readonly assigneeId: string;
  readonly type: string;
};

type WorkItemProjectLookup = Pick<DbWorkItem, 'id' | 'project_id'> & {
  readonly project?: { readonly key?: string | null } | null;
};

type ProjectKeyLookup = {
  readonly id: string;
  readonly key: string;
};

export function resolveWorkItemProjectKey(
  item: WorkItemProjectLookup,
  projects: readonly ProjectKeyLookup[]
): string {
  return (
    item.project?.key ??
    projects.find((project) => project.id === item.project_id)?.key ??
    'ITEM'
  );
}

export function formatCalendarWorkItemDisplayKey(
  item: WorkItemProjectLookup,
  projects: readonly ProjectKeyLookup[]
): string {
  return `${resolveWorkItemProjectKey(item, projects)}-${item.id.slice(-4)}`;
}

export function matchesCalendarWorkItemSearch(
  item: DbWorkItem,
  query: string,
  projects: readonly ProjectKeyLookup[]
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const projectKey = resolveWorkItemProjectKey(item, projects);
  const displayKey = formatCalendarWorkItemDisplayKey(item, projects);
  const haystack = [
    item.title,
    displayKey,
    projectKey,
    item.assignee?.name,
    item.type,
    item.status,
    item.priority,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalized);
}

function matchesCalendarFilters(
  item: DbWorkItem,
  options: CalendarFilterOptions
): boolean {
  const matchesProject =
    options.projectValue === QUERY_FILTER_ALL_VALUE ||
    !options.projectValue ||
    item.project_id === options.projectValue;
  const matchesSprint =
    options.sprintValue === QUERY_FILTER_ALL_VALUE ||
    !options.sprintValue ||
    item.sprint_id === options.sprintValue;
  const matchesAssignee =
    options.assigneeId === ALL_OPTION ||
    item.assignee_id === options.assigneeId;
  const matchesType = options.type === ALL_OPTION || item.type === options.type;

  return matchesProject && matchesSprint && matchesAssignee && matchesType;
}

export function groupWorkItemsByDueDate(
  items: readonly DbWorkItem[]
): Record<string, DbWorkItem[]> {
  const map: Record<string, DbWorkItem[]> = {};
  items.forEach((item) => {
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
}
