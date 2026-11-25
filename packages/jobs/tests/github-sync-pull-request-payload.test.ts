import { describe, expect, it } from 'vitest';
import {
  githubSyncPullRequestJobId,
  githubSyncPullRequestPayloadSchema,
} from '../src/payloads/github-sync-pull-request';

describe('github sync pull request payload', () => {
  it('builds a stable BullMQ job id from the delivery id', () => {
    expect(githubSyncPullRequestJobId('del-9')).toBe('github-sync-pr-del-9');
  });

  it('accepts a normalized PR sync payload', () => {
    const parsed = githubSyncPullRequestPayloadSchema.parse({
      deliveryId: 'd1',
      installationId: 42,
      action: 'opened',
      repoOwner: 'acme',
      repoName: 'widgets',
      prNumber: 7,
      prTitle: 'Fix login',
      prUrl: 'https://github.com/acme/widgets/pull/7',
      branchName: 'ALICE-fix-login',
      status: 'open',
      receivedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(parsed.status).toBe('open');
    expect(parsed.branchName).toBe('ALICE-fix-login');
  });
});
