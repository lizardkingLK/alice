/** Alice source-control domain event type names (orchestrator inputs). */
export const SC_DOMAIN_EVENT_TYPES = {
  pullRequestOpened: 'PullRequestOpened',
  pullRequestUpdated: 'PullRequestUpdated',
  pullRequestClosed: 'PullRequestClosed',
  pullRequestMerged: 'PullRequestMerged',
  pushReceived: 'PushReceived',
  branchCreated: 'BranchCreated',
  branchUpdated: 'BranchUpdated',
  branchDeleted: 'BranchDeleted',
} as const;

export type ScDomainEventType =
  (typeof SC_DOMAIN_EVENT_TYPES)[keyof typeof SC_DOMAIN_EVENT_TYPES];
