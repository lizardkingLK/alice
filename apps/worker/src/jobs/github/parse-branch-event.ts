import type {
  GithubSyncBranchPayload,
  GithubWebhookIngestPayload,
} from '@repo/jobs';

type GithubRefBody = {
  ref?: unknown;
  ref_type?: unknown;
  master_branch?: unknown;
  description?: unknown;
  repository?: {
    name?: unknown;
    owner?: { login?: unknown };
  };
  installation?: { id?: unknown };
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function asPositiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null;
}

/**
 * Normalize GitHub `create` / `delete` branch events into sync payloads.
 */
export function parseBranchSyncPayload(
  ingest: GithubWebhookIngestPayload
): GithubSyncBranchPayload | null {
  if (ingest.event !== 'create' && ingest.event !== 'delete') {
    return null;
  }

  const body = (ingest.payload ?? {}) as GithubRefBody;
  if (asNonEmptyString(body.ref_type) !== 'branch') {
    return null;
  }

  const branchName = asNonEmptyString(body.ref);
  const installationId =
    ingest.installationId ?? asPositiveInt(body.installation?.id);
  const repoOwner = asNonEmptyString(body.repository?.owner?.login);
  const repoName = asNonEmptyString(body.repository?.name);

  if (installationId == null || !branchName || !repoOwner || !repoName) {
    return null;
  }

  return {
    deliveryId: ingest.deliveryId,
    installationId,
    action: ingest.event === 'create' ? 'create' : 'delete',
    repoOwner,
    repoName,
    branchName,
    headSha: null,
    receivedAt: ingest.receivedAt,
  };
}
