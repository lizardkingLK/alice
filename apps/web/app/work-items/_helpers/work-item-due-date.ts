import type { WorkItemStatus } from '@repo/types';

/** Local calendar day as `YYYY-MM-DD` (matches API due-date checks). */
export function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Normalize DB/ISO timestamps to `YYYY-MM-DD` for comparisons. */
export function toDateOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.split('T')[0] ?? null;
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
