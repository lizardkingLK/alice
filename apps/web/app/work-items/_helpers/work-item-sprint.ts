/** Sprint option for work-item create/edit and details patch dialogs. */
export type WorkItemSprintOption = {
  readonly id: string;
  readonly name: string;
  readonly status?: string;
};

/** Sentinel for “Backlog” in select controls (maps to `sprint_id: null`). */
export const WORK_ITEM_SPRINT_BACKLOG_VALUE = '__backlog__';

export function sprintIdFromSelectValue(value: string): string | null {
  if (!value || value === WORK_ITEM_SPRINT_BACKLOG_VALUE) {
    return null;
  }
  return value;
}

export function selectValueFromSprintId(
  sprintId: string | null | undefined
): string {
  return sprintId?.trim() || WORK_ITEM_SPRINT_BACKLOG_VALUE;
}
