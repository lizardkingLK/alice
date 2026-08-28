/** Actor cannot view or mutate sprints outside their accessible projects. */
export class SprintAccessError extends Error {
  constructor(message = "You're not a member of this project.") {
    super(message);
    this.name = 'SprintAccessError';
  }
}
