import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueGithubSyncPullRequest = vi.fn();
const enqueueGithubSyncPush = vi.fn();
const enqueueGithubSyncBranch = vi.fn();

vi.mock('@repo/jobs', async () => {
  const actual =
    await vi.importActual<typeof import('@repo/jobs')>('@repo/jobs');
  return {
    ...actual,
    enqueueGithubSyncPullRequest: (...args: unknown[]) =>
      enqueueGithubSyncPullRequest(...args),
    enqueueGithubSyncPush: (...args: unknown[]) =>
      enqueueGithubSyncPush(...args),
    enqueueGithubSyncBranch: (...args: unknown[]) =>
      enqueueGithubSyncBranch(...args),
  };
});

vi.mock('../src/config/env', () => ({
  env: {
    REDIS_URL: 'redis://localhost:6379',
  },
}));

import { handleGithubWebhookIngest } from '../src/jobs/github-webhook.ingest';

describe('handleGithubWebhookIngest', () => {
  beforeEach(() => {
    enqueueGithubSyncPullRequest.mockReset().mockResolvedValue({
      jobId: 'github-sync-pr-d1',
      duplicate: false,
    });
    enqueueGithubSyncPush.mockReset().mockResolvedValue({
      jobId: 'github-sync-push-d1',
      duplicate: false,
    });
    enqueueGithubSyncBranch.mockReset().mockResolvedValue({
      jobId: 'github-sync-branch-d1',
      duplicate: false,
    });
  });

  it('no-ops ping events', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await handleGithubWebhookIngest({
      deliveryId: 'd-ping',
      event: 'ping',
      receivedAt: '2026-01-01T00:00:00.000Z',
      payload: { zen: 'Keep it logically awesome.' },
    });

    expect(enqueueGithubSyncPullRequest).not.toHaveBeenCalled();
    expect(enqueueGithubSyncPush).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('fans out pull_request events', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await handleGithubWebhookIngest({
      deliveryId: 'd1',
      event: 'pull_request',
      action: 'opened',
      installationId: 7,
      receivedAt: '2026-01-01T00:00:00.000Z',
      payload: {
        action: 'opened',
        pull_request: {
          number: 4,
          title: 'Hello',
          html_url: 'https://github.com/acme/app/pull/4',
          state: 'open',
          head: { ref: 'ALICE-hello' },
        },
        repository: {
          name: 'app',
          owner: { login: 'acme' },
        },
        installation: { id: 7 },
      },
    });

    expect(enqueueGithubSyncPullRequest).toHaveBeenCalled();
    log.mockRestore();
  });

  it('fans out push events', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await handleGithubWebhookIngest({
      deliveryId: 'd-push',
      event: 'push',
      installationId: 7,
      receivedAt: '2026-01-01T00:00:00.000Z',
      payload: {
        ref: 'refs/heads/main',
        before: 'a',
        after: 'b',
        created: false,
        deleted: false,
        commits: [],
        repository: { name: 'app', owner: { login: 'acme' } },
        installation: { id: 7 },
      },
    });

    expect(enqueueGithubSyncPush).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({ branchName: 'main' })
    );
    log.mockRestore();
  });

  it('fans out branch create events', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await handleGithubWebhookIngest({
      deliveryId: 'd-create',
      event: 'create',
      installationId: 7,
      receivedAt: '2026-01-01T00:00:00.000Z',
      payload: {
        ref: 'feature/x',
        ref_type: 'branch',
        repository: { name: 'app', owner: { login: 'acme' } },
        installation: { id: 7 },
      },
    });

    expect(enqueueGithubSyncBranch).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({ action: 'create', branchName: 'feature/x' })
    );
    log.mockRestore();
  });
});
