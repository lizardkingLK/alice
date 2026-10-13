import { WorkItemValidationError } from './work-items.errors.js';
import { sameNullable } from './work-items.patch-utils.js';

export const CHILD_SPRINT_INHERITANCE_MESSAGE =
  'Subtasks inherit the sprint from their parent. Change the parent’s sprint or remove the parent link to plan this item separately.';

export function assertChildSprintMatchesParent(
  parentSprintId: string | null | undefined,
  childSprintId: string | null | undefined
): void {
  if (!sameNullable(childSprintId ?? null, parentSprintId ?? null)) {
    throw new WorkItemValidationError(CHILD_SPRINT_INHERITANCE_MESSAGE);
  }
}
