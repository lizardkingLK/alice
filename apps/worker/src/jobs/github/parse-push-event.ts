import type {
  GithubSyncPushPayload,
  GithubWebhookIngestPayload,
} from '@repo/jobs';

type GithubPushBody = {
  ref?: unknown;
  before?: unknown;
  after?: unknown;
  created?: unknown;
  deleted?: unknown;
  commits?: unknown;
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

function branchNameFromRef(ref: string): string | null {
  const prefix = 'refs/heads/';
  if (!ref.startsWith(prefix)) {
    return null;
  }
  const name = ref.slice(prefix.length);
  return name.length > 0 ? name : null;
}

function parseCommit(
  raw: unknown
): GithubSyncPushPayload['commits'][number] | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const commit = raw as {
    id?: unknown;
    message?: unknown;
    timestamp?: unknown;
    url?: unknown;
    author?: { name?: unknown; email?: unknown; username?: unknown };
  };
  const sha = asNonEmptyString(commit.id);
  if (!sha) {
    return null;
  }
  return {
    sha,
    message: asNonEmptyString(commit.message) ?? '',
    authorLogin: asNonEmptyString(commit.author?.username),
    authorName: asNonEmptyString(commit.author?.name),
    authorEmail: asNonEmptyString(commit.author?.email),
    committedAt: asNonEmptyString(commit.timestamp),
    htmlUrl: asNonEmptyString(commit.url),
  };
}

/**
 * Normalize a GitHub `push` webhook into a sync job payload.
 * Non-branch refs (tags) return null.
 */
export function parsePushSyncPayload(
  ingest: GithubWebhookIngestPayload
): GithubSyncPushPayload | null {
  const body = (ingest.payload ?? {}) as GithubPushBody;
  const ref = asNonEmptyString(body.ref);
  if (!ref) {
    return null;
  }
  const branchName = branchNameFromRef(ref);
  if (!branchName) {
    return null;
  }

  const installationId =
    ingest.installationId ?? asPositiveInt(body.installation?.id);
  const repoOwner = asNonEmptyString(body.repository?.owner?.login);
  const repoName = asNonEmptyString(body.repository?.name);
  if (installationId == null || !repoOwner || !repoName) {
    return null;
  }

  const commitsRaw = Array.isArray(body.commits) ? body.commits : [];
  const commits = commitsRaw
    .map(parseCommit)
    .filter((row): row is NonNullable<typeof row> => row != null);

  return {
    deliveryId: ingest.deliveryId,
    installationId,
    repoOwner,
    repoName,
    ref,
    branchName,
    beforeSha: asNonEmptyString(body.before),
    afterSha: asNonEmptyString(body.after),
    created: body.created === true,
    deleted: body.deleted === true,
    commits,
    receivedAt: ingest.receivedAt,
  };
}
