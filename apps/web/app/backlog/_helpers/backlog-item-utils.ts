import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { formatDate } from '@/app/_shared/utility';
import {
  mapPriorityToBacklogPriority,
  type BacklogPriority,
} from '@/app/work-items/_helpers/work-item-priority-ui';
import type { WorkItemPriority } from '@repo/types';

export type BacklogActiveTab = 'active' | 'completed';

export type BacklogAssignee = {
  id: string;
  name: string;
  email: string;
  profile_picture?: string | null;
};

export function mapPriority(priority: WorkItemPriority): BacklogPriority {
  return mapPriorityToBacklogPriority(priority);
}

export function formatDateRange(
  start: string | null | Date,
  end: string | null | Date
): string {
  if (!start || !end) return 'No dates set';
  const startValue = start instanceof Date ? start.toISOString() : start;
  const endValue = end instanceof Date ? end.toISOString() : end;
  return `${formatDate(startValue)} - ${formatDate(endValue)}`;
}

export function projectDisplayKey(
  projectKey: string | undefined,
  itemId: string
): string {
  return `${projectKey || 'ALICE'}-${itemId.slice(0, 4).toUpperCase()}`;
}

export function getFormDataStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return '';
}

export function updateWorkItemField<K extends keyof DbWorkItem>(
  item: DbWorkItem,
  itemId: string,
  field: K,
  value: DbWorkItem[K],
  updatedAssignee: BacklogAssignee | null
): DbWorkItem {
  if (item.id === itemId) {
    const updated = { ...item, [field]: value };
    if (field === 'assignee_id') {
      updated.assignee = updatedAssignee;
    }
    return updated;
  }
  return item;
}
