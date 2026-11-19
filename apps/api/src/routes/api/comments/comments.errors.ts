/** Actor cannot view or mutate comments outside their accessible projects. */
export class CommentAccessError extends Error {
  constructor(message = "You're not a member of this project.") {
    super(message);
    this.name = 'CommentAccessError';
  }
}

/** Reply target is outside the work-item discussion receiving the reply. */
export class CommentReplyScopeError extends Error {
  constructor() {
    super('Reply parent must belong to the same work item.');
    this.name = 'CommentReplyScopeError';
  }
}
