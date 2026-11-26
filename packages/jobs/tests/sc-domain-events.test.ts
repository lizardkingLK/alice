import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SC_DOMAIN_EVENT_TYPES,
  clearScDomainEventSubscribers,
  emitScDomainEvent,
  mapBranchSyncToDomainEvent,
  mapPullRequestSyncToDomainEvent,
  mapPushSyncToDomainEvent,
  onScDomainEvent,
} from '../src/domain-events/index';

afterEach(() => {
  clearScDomainEventSubscribers();
});

describe('mapPullRequestSyncToDomainEvent', () => {
  const basePayload = {
    deliveryId: 'd1',
    installationId: 1,
    action: 'synchronize',
    repoOwner: 'acme',
    repoName: 'app',
    prNumber: 9,
    prTitle: 'Fix',
    prUrl: 'https://github.com/acme/app/pull/9',
    branchName: 'ALICE-fix',
    status: 'open' as const,
    receivedAt: '2026-01-01T00:00:00.000Z',
  };

  it('maps opened action to PullRequestOpened', () => {
    const event = mapPullRequestSyncToDomainEvent({
      payload: { ...basePayload, action: 'opened' },
      workItemId: 'wi-1',
      prId: 'pr-1',
    });
    expect(event.type).toBe(SC_DOMAIN_EVENT_TYPES.pullRequestOpened);
  });

  it('maps merged status to PullRequestMerged', () => {
    const event = mapPullRequestSyncToDomainEvent({
      payload: { ...basePayload, status: 'merged' },
    });
    expect(event.type).toBe(SC_DOMAIN_EVENT_TYPES.pullRequestMerged);
  });

  it('maps closed status to PullRequestClosed', () => {
    const event = mapPullRequestSyncToDomainEvent({
      payload: { ...basePayload, status: 'closed' },
    });
    expect(event.type).toBe(SC_DOMAIN_EVENT_TYPES.pullRequestClosed);
  });
});

describe('mapPushSyncToDomainEvent / mapBranchSyncToDomainEvent', () => {
  it('maps push to PushReceived', () => {
    const event = mapPushSyncToDomainEvent({
      payload: {
        deliveryId: 'd-push',
        installationId: 2,
        repoOwner: 'acme',
        repoName: 'app',
        ref: 'refs/heads/main',
        branchName: 'main',
        beforeSha: 'a',
        afterSha: 'b',
        created: false,
        deleted: false,
        commits: [],
        receivedAt: '2026-01-01T00:00:00.000Z',
      },
      projectId: 'proj-1',
      commitCount: 0,
    });
    expect(event.type).toBe(SC_DOMAIN_EVENT_TYPES.pushReceived);
  });

  it('maps branch delete to BranchDeleted', () => {
    const event = mapBranchSyncToDomainEvent({
      payload: {
        deliveryId: 'd-del',
        installationId: 2,
        action: 'delete',
        repoOwner: 'acme',
        repoName: 'app',
        branchName: 'tmp',
        headSha: null,
        receivedAt: '2026-01-01T00:00:00.000Z',
      },
      projectId: 'proj-1',
    });
    expect(event.type).toBe(SC_DOMAIN_EVENT_TYPES.branchDeleted);
  });
});

describe('emitScDomainEvent', () => {
  it('notifies subscribers and returns a validated event', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const seen: string[] = [];
    onScDomainEvent((event) => {
      seen.push(event.type);
    });

    const event = await emitScDomainEvent(
      mapPullRequestSyncToDomainEvent({
        payload: {
          deliveryId: 'd2',
          installationId: 3,
          action: 'opened',
          repoOwner: 'acme',
          repoName: 'app',
          prNumber: 1,
          prTitle: 'Hi',
          prUrl: 'https://github.com/acme/app/pull/1',
          branchName: null,
          status: 'open',
          receivedAt: '2026-01-01T00:00:00.000Z',
        },
      })
    );

    expect(event.eventId).toBeTruthy();
    expect(event.type).toBe(SC_DOMAIN_EVENT_TYPES.pullRequestOpened);
    expect(seen).toEqual([SC_DOMAIN_EVENT_TYPES.pullRequestOpened]);
    log.mockRestore();
  });
});
