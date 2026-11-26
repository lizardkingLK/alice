import { describe, expect, it } from 'vitest';
import { parsePullRequestSyncPayload } from '../../src/jobs/github/parse-pull-request-event';

describe('parsePullRequestSyncPayload', () => {
  it('normalizes a pull_request webhook body', () => {
    const parsed = parsePullRequestSyncPayload({
      deliveryId: 'del-1',
      event: 'pull_request',
      action: 'opened',
      installationId: 99,
      receivedAt: '2026-01-01T00:00:00.000Z',
      payload: {
        action: 'opened',
        number: 12,
        pull_request: {
          number: 12,
          title: 'Add feature',
          html_url: 'https://github.com/acme/app/pull/12',
          state: 'open',
          merged: false,
          head: { ref: 'ALICE-add-feature' },
        },
        repository: {
          name: 'app',
          owner: { login: 'acme' },
        },
        installation: { id: 99 },
      },
    });

    expect(parsed).toEqual({
      deliveryId: 'del-1',
      installationId: 99,
      action: 'opened',
      repoOwner: 'acme',
      repoName: 'app',
      prNumber: 12,
      prTitle: 'Add feature',
      prUrl: 'https://github.com/acme/app/pull/12',
      branchName: 'ALICE-add-feature',
      status: 'open',
      receivedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('marks merged PRs as merged', () => {
    const parsed = parsePullRequestSyncPayload({
      deliveryId: 'del-2',
      event: 'pull_request',
      receivedAt: '2026-01-01T00:00:00.000Z',
      payload: {
        action: 'closed',
        pull_request: {
          number: 3,
          title: 'Done',
          html_url: 'https://github.com/acme/app/pull/3',
          state: 'closed',
          merged: true,
          head: { ref: 'main' },
        },
        repository: {
          name: 'app',
          owner: { login: 'acme' },
        },
        installation: { id: 1 },
      },
    });

    expect(parsed?.status).toBe('merged');
  });

  it('returns null when required fields are missing', () => {
    expect(
      parsePullRequestSyncPayload({
        deliveryId: 'del-3',
        event: 'pull_request',
        receivedAt: '2026-01-01T00:00:00.000Z',
        payload: { action: 'opened' },
      })
    ).toBeNull();
  });
});
