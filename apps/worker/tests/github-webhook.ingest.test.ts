import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueGithubSyncPullRequest = vi.fn();

vi.mock('@repo/jobs', async () => {
  const actual =
    await vi.importActual<typeof import('@repo/jobs')>('@repo/jobs');
  return {
    ...actual,
    enqueueGithubSyncPullRequest: (...args: unknown[]) =>
      enqueueGithubSyncPullRequest(...args),
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
    enqueueGithubSyncPullRequest.mockReset();
    enqueueGithubSyncPullRequest.mockResolvedValue({
      jobId: 'github-sync-pr-d1',
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
    log.mockRestore();
  });

  it('skips events that are not pull_request yet', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await handleGithubWebhookIngest({
      deliveryId: 'd-push',
      event: 'push',
      receivedAt: '2026-01-01T00:00:00.000Z',
      payload: {},
    });

    expect(enqueueGithubSyncPullRequest).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('fans out pull_request events to github.sync.pull_request', async () => {
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

    expect(enqueueGithubSyncPullRequest).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({
        deliveryId: 'd1',
        installationId: 7,
        prNumber: 4,
        branchName: 'ALICE-hello',
        status: 'open',
      })
    );
    log.mockRestore();
  });
});
