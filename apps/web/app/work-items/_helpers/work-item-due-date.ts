import { todayDateString, toDateOnly, type WorkItemStatus } from '@repo/types';

/**
 * `YYYY-MM-DD` for `<input type="date">`, or empty when unset.
 */
export function toDateInputValue(value: string | null | undefined): string {
  return toDateOnly(value) ?? '';
}

/**
 * Past due date and not Done. Date-only values compare as calendar days
 * (today is not overdue).
 */
export function isWorkItemOverdue(
  dueDate: string | null | undefined,
  status: WorkItemStatus
): boolean {
  if (status === 'Done') {
    return false;
  }
  const dateOnly = toDateOnly(dueDate);
  if (!dateOnly) {
    return false;
  }
  return dateOnly < todayDateString();
}
