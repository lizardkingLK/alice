export type GetSprintsPaginatedOptions = {
  readonly projectId?: string;
  /** When set, list is limited to these project IDs (accessible scope). */
  readonly projectIds?: readonly string[];
};
