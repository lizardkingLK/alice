/** Actor cannot view or mutate comments outside their accessible projects. */
export class CommentAccessError extends Error {
  constructor(message = "You're not a member of this project.") {
    super(message);
    this.name = 'CommentAccessError';
  }
}
