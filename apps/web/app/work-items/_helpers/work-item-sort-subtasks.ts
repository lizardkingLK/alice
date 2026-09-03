import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';

export type SubtaskSortField = 'none' | 'title' | 'priority' | 'assignee';
export type SubtaskSortDirection = 'asc' | 'desc';

const PRIORITY_RANK: Record<DbWorkItem['priority'], number> = {
  lowest: 0,
  low: 1,
  medium: 2,
  high: 3,
  highest: 4,
};

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function compareNullableStrings(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const left = a?.trim() || '';
  const right = b?.trim() || '';
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }
  return compareStrings(left, right);
}

function compareSubtasks(
  a: DbWorkItem,
  b: DbWorkItem,
  field: Exclude<SubtaskSortField, 'none'>
): number {
  switch (field) {
    case 'title':
      return compareStrings(a.title, b.title);
    case 'priority':
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    case 'assignee':
      return compareNullableStrings(a.assignee?.name, b.assignee?.name);
    default:
      return 0;
  }
}

/** Stable client-side sort for the subtasks table. `none` keeps input order. */
export function sortSubtasks(
  items: readonly DbWorkItem[],
  field: SubtaskSortField,
  direction: SubtaskSortDirection
): DbWorkItem[] {
  if (field === 'none' || items.length < 2) {
    return [...items];
  }

  const directionFactor = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const result = compareSubtasks(a, b, field);
    if (result !== 0) {
      return result * directionFactor;
    }
    return compareStrings(a.id, b.id);
  });
}

export const SUBTASK_SORT_FIELD_LABELS: Record<SubtaskSortField, string> = {
  none: 'None',
  title: 'Title',
  priority: 'Priority',
  assignee: 'Assignee',
};

export const SUBTASK_SORT_FIELDS = Object.keys(
  SUBTASK_SORT_FIELD_LABELS
) as SubtaskSortField[];

export const SUBTASK_SORT_DIRECTION_LABELS: Record<
  SubtaskSortDirection,
  string
> = {
  asc: 'A–Z',
  desc: 'Z–A',
};

export const SUBTASK_SORT_DIRECTIONS = Object.keys(
  SUBTASK_SORT_DIRECTION_LABELS
) as SubtaskSortDirection[];
