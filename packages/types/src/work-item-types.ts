import { Constants } from './generated/supabase/database.types.js';

/** Canonical ordered work-item types (matches DB enum). */
export const WORK_ITEM_TYPES = Constants.public.Enums.WorkItemType;

export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];

/**
 * Parent → allowed child type for subtask creation.
 * Issue is a leaf and has no children.
 */
export const WORK_ITEM_CHILD_TYPE: Partial<Record<WorkItemType, WorkItemType>> =
  {
    Epic: 'Story',
    Story: 'Task',
    Task: 'Issue',
  };

export function getAllowedChildType(
  parentType: WorkItemType
): WorkItemType | null {
  return WORK_ITEM_CHILD_TYPE[parentType] ?? null;
}
