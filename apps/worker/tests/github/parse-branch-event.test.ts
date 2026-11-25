import { describe, expect, it } from 'vitest';
import { parseBranchSyncPayload } from '../../src/jobs/github/parse-branch-event';

describe('parseBranchSyncPayload', () => {
  it('normalizes create branch events', () => {
    expect(
      parseBranchSyncPayload({
        deliveryId: 'd-create',
        event: 'create',
        receivedAt: '2026-01-01T00:00:00.000Z',
        payload: {
          ref: 'feature/ALICE-x',
          ref_type: 'branch',
          repository: { name: 'app', owner: { login: 'acme' } },
          installation: { id: 9 },
        },
      })
    ).toEqual({
      deliveryId: 'd-create',
      installationId: 9,
      action: 'create',
      repoOwner: 'acme',
      repoName: 'app',
      branchName: 'feature/ALICE-x',
      headSha: null,
      receivedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('ignores tag create events', () => {
    expect(
      parseBranchSyncPayload({
        deliveryId: 'd-tag',
        event: 'create',
        receivedAt: '2026-01-01T00:00:00.000Z',
        payload: {
          ref: 'v1',
          ref_type: 'tag',
          repository: { name: 'app', owner: { login: 'acme' } },
          installation: { id: 1 },
        },
      })
    ).toBeNull();
  });
});
