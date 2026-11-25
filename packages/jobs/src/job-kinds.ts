/**
 * Stable BullMQ job `name` values.
 * Source-control kinds follow WORKER_AND_STREAMER + GITHUB_INTEGRATION Phase 2+.
 */
export const JOB_KINDS = {
  githubWebhookIngest: 'github.webhook.ingest',
  githubSyncPullRequest: 'github.sync.pull_request',
  githubSyncPush: 'github.sync.push',
  githubSyncBranch: 'github.sync.branch',
  /** Phase 4 orchestrator parent — consumes SC domain events. */
  workflowRun: 'workflow.run',
} as const;

export type JobKind = (typeof JOB_KINDS)[keyof typeof JOB_KINDS];
