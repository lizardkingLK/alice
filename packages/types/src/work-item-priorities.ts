import { Constants } from './generated/supabase/database.types.js';
import { WorkItemPriority as WorkItemPriorityEnum } from './generated/prisma/enums.js';

/** Canonical ordered work-item priorities (matches DB enum). */
export const WORK_ITEM_PRIORITIES = Constants.public.Enums.WorkItemPriority;

export { WorkItemPriorityEnum };
export type WorkItemPriority = (typeof WORK_ITEM_PRIORITIES)[number];

export const DEFAULT_WORK_ITEM_PRIORITY: WorkItemPriority =
  WorkItemPriorityEnum.medium;
