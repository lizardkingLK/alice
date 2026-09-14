/** Actor cannot view or mutate sprints outside their accessible projects. */
export class SprintAccessError extends Error {
  constructor(message = "You're not a member of this project.") {
    super(message);
    this.name = 'SprintAccessError';
  }
}

/** Duplicate sprint name within a project (all statuses, including archived). */
export const SPRINT_NAME_CONFLICT_MESSAGE =
  'An active or archived sprint already exists by the given name';

export function sprintNameConflictMessage(): string {
  return SPRINT_NAME_CONFLICT_MESSAGE;
}

export function isSprintNameConflictMessage(message: string): boolean {
  return /active or archived sprint already exists by the given name/i.test(
    message
  );
}
