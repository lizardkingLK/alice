import type { GithubSyncBranchPayload } from '../payloads/github-sync-branch.js';
import type { GithubSyncPullRequestPayload } from '../payloads/github-sync-pull-request.js';
import type { GithubSyncPushPayload } from '../payloads/github-sync-push.js';
import { SC_DOMAIN_EVENT_TYPES } from './sc-event-types.js';
import type { ScDomainEventDraft } from './sc-events.js';

type PrMapInput = {
  payload: GithubSyncPullRequestPayload;
  projectId?: string;
  workItemId?: string | null;
  prId?: string;
};

export function mapPullRequestSyncToDomainEvent(
  input: PrMapInput
): ScDomainEventDraft {
  const { payload, projectId, workItemId, prId } = input;
  const base = {
    deliveryId: payload.deliveryId,
    installationId: payload.installationId,
    repoOwner: payload.repoOwner,
    repoName: payload.repoName,
    projectId,
    workItemId: workItemId ?? null,
    prNumber: payload.prNumber,
    prId,
    prTitle: payload.prTitle,
    prUrl: payload.prUrl,
    branchName: payload.branchName,
  };

  if (payload.action === 'opened') {
    return {
      ...base,
      type: SC_DOMAIN_EVENT_TYPES.pullRequestOpened,
      status: 'open',
    };
  }

  if (payload.status === 'merged') {
    return {
      ...base,
      type: SC_DOMAIN_EVENT_TYPES.pullRequestMerged,
      status: 'merged',
    };
  }

  if (payload.status === 'closed') {
    return {
      ...base,
      type: SC_DOMAIN_EVENT_TYPES.pullRequestClosed,
      status: 'closed',
    };
  }

  return {
    ...base,
    type: SC_DOMAIN_EVENT_TYPES.pullRequestUpdated,
    status: payload.status,
  };
}

export function mapPushSyncToDomainEvent(input: {
  payload: GithubSyncPushPayload;
  projectId: string;
  workItemId?: string | null;
  branchId?: string;
  commitCount: number;
}): ScDomainEventDraft {
  const { payload, projectId, workItemId, branchId, commitCount } = input;
  return {
    type: SC_DOMAIN_EVENT_TYPES.pushReceived,
    deliveryId: payload.deliveryId,
    installationId: payload.installationId,
    repoOwner: payload.repoOwner,
    repoName: payload.repoName,
    projectId,
    workItemId: workItemId ?? null,
    branchName: payload.branchName,
    beforeSha: payload.beforeSha,
    afterSha: payload.afterSha,
    created: payload.created,
    deleted: payload.deleted,
    commitCount,
    branchId,
  };
}

export function mapBranchSyncToDomainEvent(input: {
  payload: GithubSyncBranchPayload;
  projectId: string;
  workItemId?: string | null;
  branchId?: string;
}): ScDomainEventDraft {
  const { payload, projectId, workItemId, branchId } = input;
  const base = {
    deliveryId: payload.deliveryId,
    installationId: payload.installationId,
    repoOwner: payload.repoOwner,
    repoName: payload.repoName,
    projectId,
    workItemId: workItemId ?? null,
    branchName: payload.branchName,
    headSha: payload.headSha,
    branchId,
  };

  if (payload.action === 'create') {
    return { ...base, type: SC_DOMAIN_EVENT_TYPES.branchCreated };
  }
  if (payload.action === 'delete') {
    return { ...base, type: SC_DOMAIN_EVENT_TYPES.branchDeleted };
  }
  return { ...base, type: SC_DOMAIN_EVENT_TYPES.branchUpdated };
}
