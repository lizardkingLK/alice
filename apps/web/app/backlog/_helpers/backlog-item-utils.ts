import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';

export type BacklogPriority = 'low' | 'medium' | 'high';

export type BacklogActiveTab = 'active' | 'completed';

export type BacklogAssignee = {
  id: string;
  name: string;
  email: string;
  profile_picture?: string | null;
};

export const BACKLOG_TYPE_STYLES: Record<string, string> = {
  Epic: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  Story: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  Task: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
};

export const BACKLOG_PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  medium:
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
};

export function mapPriority(priority: string): BacklogPriority {
  if (priority === 'highest') return 'high';
  if (priority === 'lowest') return 'low';
  return priority as BacklogPriority;
}

export function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function formatDateRange(
  start: string | null | Date,
  end: string | null | Date
): string {
  if (!start || !end) return 'No dates set';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
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
