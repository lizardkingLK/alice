export class WorkItemValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkItemValidationError';
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
