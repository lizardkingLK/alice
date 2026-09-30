import {
  BOARD_MOVE_FORBIDDEN_CODE,
  STATUS_TRANSITION_FORBIDDEN_CODE,
} from '@repo/types';

export class WorkItemValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkItemValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Type change blocked because the item still has direct children. */
export class WorkItemHierarchyTypeChangeError extends WorkItemValidationError {
  readonly code = 'HIERARCHY_TYPE_CHANGE' as const;
  readonly childCount: number;
  readonly httpStatus = 409;

  constructor(childCount: number) {
    super(
      `This work item has ${childCount} subtask${childCount === 1 ? '' : 's'}. Unlink them first, or confirm detaching children when changing type.`
    );
    this.name = 'WorkItemHierarchyTypeChangeError';
    this.childCount = childCount;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Actor cannot view or mutate work items outside their accessible projects. */
export class WorkItemAccessError extends Error {
  constructor(message = "You're not a member of this project.") {
    super(message);
    this.name = 'WorkItemAccessError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Actor has project access but does not satisfy a configured board rule. */
export class BoardMoveForbiddenError extends WorkItemAccessError {
  readonly code = BOARD_MOVE_FORBIDDEN_CODE;

  constructor() {
    super('You do not have permission to perform this board movement.');
    this.name = 'BoardMoveForbiddenError';
  }
}

/** Actor has project access but does not satisfy a configured status rule. */
export class StatusTransitionForbiddenError extends WorkItemAccessError {
  readonly code = STATUS_TRANSITION_FORBIDDEN_CODE;

  constructor() {
    super('You do not have permission to perform this status transition.');
    this.name = 'StatusTransitionForbiddenError';
  }
}
