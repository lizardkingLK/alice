import { SPRINT_ESTIMATION_TARGET_LIMIT } from './sprint-estimation.constants';

/** Actor cannot view or mutate sprints outside their accessible projects. */
export class SprintAccessError extends Error {
  constructor(message = "You're not a member of this project.") {
    super(message);
    this.name = 'SprintAccessError';
  }
}

export class SprintEstimationUnauthenticatedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'SprintEstimationUnauthenticatedError';
  }
}

export class SprintEstimationForbiddenError extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'SprintEstimationForbiddenError';
  }
}

export class SprintEstimationCancelledError extends Error {
  constructor() {
    super('Sprint estimation cancelled');
    this.name = 'SprintEstimationCancelledError';
  }
}

export class SprintEstimationNotFoundError extends Error {
  constructor() {
    super('Sprint not found');
    this.name = 'SprintEstimationNotFoundError';
  }
}

export class SprintEstimationLimitError extends Error {
  constructor() {
    super(
      `Sprint exceeds the maximum of ${SPRINT_ESTIMATION_TARGET_LIMIT} estimable work items.`
    );
    this.name = 'SprintEstimationLimitError';
  }
}

export class SprintEstimationDataError extends Error {
  constructor(message = 'Invalid sprint estimation data') {
    super(message);
    this.name = 'SprintEstimationDataError';
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
