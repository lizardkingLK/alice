import { Constants } from './generated/supabase/database.types.js';
import { WorkItemType as WorkItemTypeEnum } from './generated/prisma/enums.js';

/** Canonical ordered work-item types (matches DB enum). */
export const WORK_ITEM_TYPES = Constants.public.Enums.WorkItemType;

export { WorkItemTypeEnum };
export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];

/**
 * Parent → allowed child type for subtask creation.
 * Issue is a leaf and has no children.
 */
export const WORK_ITEM_CHILD_TYPE: Partial<Record<WorkItemType, WorkItemType>> =
  {
    [WorkItemTypeEnum.Epic]: WorkItemTypeEnum.Feature,
    [WorkItemTypeEnum.Feature]: WorkItemTypeEnum.Story,
    [WorkItemTypeEnum.Story]: WorkItemTypeEnum.Task,
    [WorkItemTypeEnum.Task]: WorkItemTypeEnum.Issue,
  };

export function getAllowedChildType(
  parentType: WorkItemType
): WorkItemType | null {
  return WORK_ITEM_CHILD_TYPE[parentType] ?? null;
}
