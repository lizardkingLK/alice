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
  options: {
    readonly projectValue: string;
    readonly sprintValue: string;
    readonly assigneeId: string;
    readonly type: string;
  }
): Array<DbWorkItem & { due_date: string }> {
  return items.filter((item): item is DbWorkItem & { due_date: string } => {
    if (!item.due_date) return false;

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
    const matchesType =
      options.type === ALL_OPTION || item.type === options.type;

    return matchesProject && matchesSprint && matchesAssignee && matchesType;
  });
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
