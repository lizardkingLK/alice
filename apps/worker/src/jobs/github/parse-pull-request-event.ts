import type {
  GithubPrSyncStatus,
  GithubSyncPullRequestPayload,
  GithubWebhookIngestPayload,
} from '@repo/jobs';
import { asNonEmptyString, asPositiveInt } from './parse-helpers';

type GithubPullRequestBody = {
  action?: unknown;
  number?: unknown;
  pull_request?: {
    number?: unknown;
    title?: unknown;
    html_url?: unknown;
    state?: unknown;
    merged?: unknown;
    head?: { ref?: unknown };
  };
  repository?: {
    name?: unknown;
    owner?: { login?: unknown };
  };
  installation?: { id?: unknown };
};

function derivePrStatus(
  pullRequest: NonNullable<GithubPullRequestBody['pull_request']>
): GithubPrSyncStatus {
  if (pullRequest.merged === true) {
    return 'merged';
  }
  if (pullRequest.state === 'closed') {
    return 'closed';
  }
  return 'open';
}

/**
 * Normalize a GitHub `pull_request` webhook into a sync job payload.
 * Returns null when required fields are missing (caller should skip).
 */
export function parsePullRequestSyncPayload(
  ingest: GithubWebhookIngestPayload
): GithubSyncPullRequestPayload | null {
  const body = (ingest.payload ?? {}) as GithubPullRequestBody;
  const pullRequest = body.pull_request;
  if (!pullRequest) {
    return null;
  }

  const installationId =
    ingest.installationId ?? asPositiveInt(body.installation?.id);
  const repoOwner = asNonEmptyString(body.repository?.owner?.login);
  const repoName = asNonEmptyString(body.repository?.name);
  const prNumber =
    asPositiveInt(pullRequest.number) ?? asPositiveInt(body.number);
  const prTitle = asNonEmptyString(pullRequest.title);
  const prUrl = asNonEmptyString(pullRequest.html_url);
  const action = asNonEmptyString(body.action) ?? ingest.action ?? 'unknown';

  if (
    installationId == null ||
    !repoOwner ||
    !repoName ||
    prNumber == null ||
    !prTitle ||
    !prUrl
  ) {
    return null;
  }

  return {
    deliveryId: ingest.deliveryId,
    installationId,
    action,
    repoOwner,
    repoName,
    prNumber,
    prTitle,
    prUrl,
    branchName: asNonEmptyString(pullRequest.head?.ref),
    status: derivePrStatus(pullRequest),
    receivedAt: ingest.receivedAt,
  };
}
