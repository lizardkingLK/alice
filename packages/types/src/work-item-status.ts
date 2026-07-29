import { Constants } from './generated/supabase/database.types.js';

/** Canonical ordered work-item statuses (matches DB enum). */
export const WORK_ITEM_STATUSES = Constants.public.Enums.WorkItemStatus;

export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

/** Board columns omit Draft. */
export const BOARD_WORK_ITEM_STATUSES = WORK_ITEM_STATUSES.filter(
  (status): status is Exclude<WorkItemStatus, 'Draft'> => status !== 'Draft'
);
