import { describe, expect, it } from 'vitest';
import { parsePushSyncPayload } from '../../src/jobs/github/parse-push-event';

describe('parsePushSyncPayload', () => {
  it('normalizes a branch push webhook', () => {
    const parsed = parsePushSyncPayload({
      deliveryId: 'd-push',
      event: 'push',
      installationId: 5,
      receivedAt: '2026-01-01T00:00:00.000Z',
      payload: {
        ref: 'refs/heads/ALICE-fix-login',
        before: 'aaa',
        after: 'bbb',
        created: false,
        deleted: false,
        commits: [
          {
            id: 'bbb',
            message: 'ALICE-fix-login: tweak',
            timestamp: '2026-01-01T00:00:00Z',
            url: 'https://github.com/acme/app/commit/bbb',
            author: {
              name: 'Ada',
              email: 'ada@example.com',
              username: 'ada',
            },
          },
        ],
        repository: {
          name: 'app',
          owner: { login: 'acme' },
        },
        installation: { id: 5 },
      },
    });

    expect(parsed).toMatchObject({
      deliveryId: 'd-push',
      branchName: 'ALICE-fix-login',
      afterSha: 'bbb',
      commits: [{ sha: 'bbb', authorLogin: 'ada' }],
    });
  });

  it('skips tag pushes', () => {
    expect(
      parsePushSyncPayload({
        deliveryId: 'd-tag',
        event: 'push',
        receivedAt: '2026-01-01T00:00:00.000Z',
        payload: {
          ref: 'refs/tags/v1.0.0',
          repository: { name: 'app', owner: { login: 'acme' } },
          installation: { id: 1 },
        },
      })
    ).toBeNull();
  });
});
