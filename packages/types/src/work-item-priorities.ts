import { Constants } from './generated/supabase/database.types.js';

/** Canonical ordered work-item priorities (matches DB enum). */
export const WORK_ITEM_PRIORITIES = Constants.public.Enums.WorkItemPriority;

export type WorkItemPriority = (typeof WORK_ITEM_PRIORITIES)[number];

export const DEFAULT_WORK_ITEM_PRIORITY: WorkItemPriority = 'medium';
