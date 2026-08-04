import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';

export type WorkItemPriority = DbWorkItem['priority'];
export type BacklogPriority = 'low' | 'medium' | 'high';

export const PRIORITY_LABELS: Record<WorkItemPriority, string> = {
  lowest: 'Lowest',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  highest: 'Highest',
};

/**
 * Priority palette tuned for board readability:
 * lowest (blue light), low (blue stronger fill), medium (green),
 * high (orange), highest (red).
 */
export const PRIORITY_BADGE_STYLES: Record<WorkItemPriority, string> = {
  lowest: 'border-sky-500/20 bg-sky-500/5 text-sky-600 dark:text-sky-400',
  low: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  medium:
    'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
  high: 'border-orange-500/20 bg-orange-500/5 text-orange-600 dark:text-orange-400',
  highest: 'border-rose-600/20 bg-rose-600/5 text-rose-700 dark:text-rose-400',
};

/** Left accent borders for board cards — same green → red ramp as badges. */
export const PRIORITY_BORDER_STYLES: Record<WorkItemPriority, string> = {
  lowest: 'border-l-sky-500',
  low: 'border-l-blue-500',
  medium: 'border-l-emerald-500',
  high: 'border-l-orange-500',
  highest: 'border-l-red-500',
};

export function mapPriorityToBacklogPriority(
  priority: WorkItemPriority
): BacklogPriority {
  if (priority === 'highest') return 'high';
  if (priority === 'lowest') return 'low';
  return priority as BacklogPriority;
}

export const BACKLOG_PRIORITY_OPTIONS: ReadonlyArray<{
  readonly value: BacklogPriority;
  readonly label: string;
}> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const WORK_ITEM_PRIORITY_OPTIONS: ReadonlyArray<WorkItemPriority> = [
  'lowest',
  'low',
  'medium',
  'high',
  'highest',
];
