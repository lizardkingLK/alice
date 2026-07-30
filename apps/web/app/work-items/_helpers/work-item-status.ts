export {
  BOARD_WORK_ITEM_STATUSES,
  WORK_ITEM_STATUSES,
  type WorkItemStatus,
} from '@repo/types';

import { BOARD_WORK_ITEM_STATUSES, type WorkItemStatus } from '@repo/types';

export const WORK_ITEM_STATUS_BADGE_STYLES: Record<WorkItemStatus, string> = {
  Draft: 'border-muted-foreground/20 bg-muted text-muted-foreground',
  New: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  ToDo: 'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  InProgress:
    'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Testing: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  Done: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

export const BOARD_STATUS_COLUMN_ACCENTS: Record<
  Exclude<WorkItemStatus, 'Draft'>,
  string
> = {
  New: 'border-t-blue-500',
  ToDo: 'border-t-violet-500',
  InProgress: 'border-t-amber-500',
  Testing: 'border-t-cyan-500',
  Done: 'border-t-emerald-500',
};

export const BOARD_STATUS_COLUMNS = BOARD_WORK_ITEM_STATUSES.map((id) => ({
  id,
  accentClassName: BOARD_STATUS_COLUMN_ACCENTS[id],
}));
