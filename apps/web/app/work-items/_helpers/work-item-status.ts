export {
  BOARD_WORK_ITEM_STATUSES,
  WORK_ITEM_STATUSES,
  type WorkItemStatus,
} from '@repo/types';

import { BOARD_WORK_ITEM_STATUSES, type WorkItemStatus } from '@repo/types';
import * as React from 'react';
import {
  Circle,
  CircleDot,
  Clock,
  FlaskConical,
  CheckCircle2,
} from '@repo/ui/lib/icons';

export const WORK_ITEM_STATUS_BADGE_STYLES: Record<WorkItemStatus, string> = {
  Draft: 'border-muted-foreground/20 bg-muted text-muted-foreground',
  New: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  ToDo: 'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  InProgress:
    'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  Testing: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  Done: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

/** Fixed completion weight per status for rollup progress (e.g. subtasks bar). */
export const WORK_ITEM_STATUS_COMPLETION_PERCENT: Record<
  WorkItemStatus,
  number
> = {
  Draft: 0,
  New: 0,
  ToDo: 0,
  InProgress: 25,
  Testing: 75,
  Done: 100,
};

export function statusCompletionPercent(status: WorkItemStatus): number {
  return WORK_ITEM_STATUS_COMPLETION_PERCENT[status] ?? 0;
}

/** True when any listed status is not Done (used before marking a parent Done). */
export function hasIncompleteStatuses(
  statuses: readonly WorkItemStatus[]
): boolean {
  return statuses.some((status) => status !== 'Done');
}

/**
 * Average of each item's status completion weight, rounded to a whole percent.
 * Empty list → 0.
 */
export function averageStatusCompletionPercent(
  statuses: readonly WorkItemStatus[]
): number {
  if (statuses.length === 0) {
    return 0;
  }
  const total = statuses.reduce(
    (sum, status) => sum + statusCompletionPercent(status),
    0
  );
  return Math.round(total / statuses.length);
}

export const BOARD_STATUS_COLUMN_ACCENTS: Record<
  Exclude<WorkItemStatus, 'Draft'>,
  string
> = {
  New: 'border-t-blue-500',
  ToDo: 'border-t-violet-500',
  InProgress: 'border-t-orange-500',
  Testing: 'border-t-cyan-500',
  Done: 'border-t-emerald-500',
};

export const BOARD_STATUS_COLUMNS = BOARD_WORK_ITEM_STATUSES.map((id) => ({
  id,
  accentClassName: BOARD_STATUS_COLUMN_ACCENTS[id],
}));

export type StatusMeta = {
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const STATUS_META: Record<string, StatusMeta> = {
  New: {
    label: 'New',
    color: 'oklch(0.63 0.18 250)',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-500/20',
    icon: Circle,
  },
  ToDo: {
    label: 'To Do',
    color: 'oklch(0.55 0.03 264)',
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-600 dark:text-slate-400',
    borderClass: 'border-slate-500/20',
    icon: CircleDot,
  },
  InProgress: {
    label: 'In Progress',
    color: 'oklch(0.75 0.15 85)',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-500/20',
    icon: Clock,
  },
  Testing: {
    label: 'Testing',
    color: 'oklch(0.62 0.19 295)',
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-600 dark:text-purple-400',
    borderClass: 'border-purple-500/20',
    icon: FlaskConical,
  },
  Done: {
    label: 'Done',
    color: 'oklch(0.65 0.17 155)',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-500/20',
    icon: CheckCircle2,
  },
};

export const STATUS_INDICATOR_BG: Record<string, string> = {
  New: 'bg-blue-500',
  ToDo: 'bg-slate-500',
  InProgress: 'bg-amber-500',
  Testing: 'bg-purple-500',
  Done: 'bg-emerald-500',
};

export const STATUS_ORDER = [
  'New',
  'ToDo',
  'InProgress',
  'Testing',
  'Done',
] as const;
