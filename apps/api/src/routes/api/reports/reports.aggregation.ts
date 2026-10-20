import type { DailyReportSnapshot, DailyReportWorkItem } from '@repo/types';

export const UPCOMING_DEADLINE_DAYS = 7;

export type DailyReportSourceItem = DailyReportWorkItem & {
  readonly labels: readonly string[];
};

export type DailyReportAggregationContext = {
  readonly reportDate: string;
  readonly timezone: string;
  readonly start: Date;
  readonly endExclusive: Date;
};

function addCalendarDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(Date.UTC(year!, month! - 1, day! + days));
  return result.toISOString().slice(0, 10);
}

function reportItem(item: DailyReportSourceItem): DailyReportWorkItem {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    priority: item.priority,
    project: item.project,
    sprint: item.sprint,
    dueDate: item.dueDate,
    storyPoints: item.storyPoints,
    statusCategory: item.statusCategory,
    stateId: item.stateId,
    doneAt: item.doneAt,
  };
}

function blockedMarker(value: string): boolean {
  const normalized = value.trim().toLowerCase().replaceAll(/[_-]+/g, ' ');
  return normalized === 'blocked' || normalized.startsWith('blocked ');
}

function isBlocked(item: DailyReportSourceItem): boolean {
  return blockedMarker(item.stateId) || item.labels.some(blockedMarker);
}

function dueDateSort(
  left: DailyReportWorkItem,
  right: DailyReportWorkItem
): number {
  return (
    (left.dueDate ?? '9999-12-31').localeCompare(
      right.dueDate ?? '9999-12-31'
    ) ||
    left.title.localeCompare(right.title) ||
    left.id.localeCompare(right.id)
  );
}

function titleSort(
  left: DailyReportWorkItem,
  right: DailyReportWorkItem
): number {
  return (
    left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
  );
}

export function buildDailyReportSnapshot(
  sourceItems: readonly DailyReportSourceItem[],
  context: DailyReportAggregationContext
): DailyReportSnapshot {
  const startMs = context.start.getTime();
  const endMs = context.endExclusive.getTime();
  const upcomingThrough = addCalendarDays(
    context.reportDate,
    UPCOMING_DEADLINE_DAYS
  );

  const completed = sourceItems
    .filter((item) => {
      if (!item.doneAt) {
        return false;
      }
      const doneAt = new Date(item.doneAt).getTime();
      return doneAt >= startMs && doneAt < endMs;
    })
    .map(reportItem)
    .sort(
      (left, right) =>
        (right.doneAt ?? '').localeCompare(left.doneAt ?? '') ||
        titleSort(left, right)
    );

  const activeItems = sourceItems.filter(
    (item) => item.statusCategory !== 'done'
  );
  const blockedSource = activeItems.filter(isBlocked);
  const blockedIds = new Set(blockedSource.map((item) => item.id));
  const blocked = blockedSource.map(reportItem).sort(titleSort);
  const inProgress = activeItems
    .filter(
      (item) =>
        item.statusCategory === 'in_progress' && !blockedIds.has(item.id)
    )
    .map(reportItem)
    .sort(dueDateSort);
  const pending = activeItems
    .filter(
      (item) =>
        (item.statusCategory === 'draft' || item.statusCategory === 'todo') &&
        !blockedIds.has(item.id)
    )
    .map(reportItem)
    .sort(dueDateSort);

  const dueToday = activeItems
    .filter((item) => item.dueDate === context.reportDate)
    .map(reportItem)
    .sort(dueDateSort);
  const overdue = activeItems
    .filter(
      (item) => item.dueDate !== null && item.dueDate < context.reportDate
    )
    .map(reportItem)
    .sort(dueDateSort);
  const upcomingDeadlines = activeItems
    .filter(
      (item) =>
        item.dueDate !== null &&
        item.dueDate > context.reportDate &&
        item.dueDate <= upcomingThrough
    )
    .map(reportItem)
    .sort(dueDateSort);

  return {
    reportDate: context.reportDate,
    timezone: context.timezone,
    utcRange: {
      start: context.start.toISOString(),
      endExclusive: context.endExclusive.toISOString(),
    },
    summary: {
      completed: completed.length,
      inProgress: inProgress.length,
      pending: pending.length,
      blocked: blocked.length,
      dueToday: dueToday.length,
      overdue: overdue.length,
      upcomingDeadlines: upcomingDeadlines.length,
    },
    completed,
    inProgress,
    pending,
    blocked,
    dueToday,
    overdue,
    upcomingDeadlines,
  };
}
