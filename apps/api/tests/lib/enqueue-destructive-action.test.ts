import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, prismaMock } = vi.hoisted(() => {
  const createMock = vi.fn();
  return {
    createMock,
    prismaMock: {
      notifications: {
        create: createMock,
      },
    },
  };
});

vi.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { enqueueDestructiveAction } from '../../src/lib/enqueue-destructive-action';
import { NotificationType as NotificationTypeEnum } from '@repo/types/prisma';

describe('enqueueDestructiveAction', () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({ id: 'notif-1' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns accepted payload immediately and notifies on success', async () => {
    const run = vi.fn().mockResolvedValue(undefined);

    const accepted = enqueueDestructiveAction({
      actorId: 'user-1',
      kind: 'archive',
      entityType: 'project',
      entityLabel: 'Acme (ACM)',
      relatedItemId: 'proj-1',
      detailHref: '/projects/proj-1',
      run,
    });

    expect(accepted.message).toMatch(/archive started/i);
    expect(accepted.correlationId).toBeTruthy();
    expect(run).toHaveBeenCalledTimes(1);

    await vi.waitFor(() => {
      expect(createMock).toHaveBeenCalled();
    });

    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 'user-1',
        type: NotificationTypeEnum.entity_archived,
        related_item_id: 'proj-1',
        message: expect.stringContaining('[Open](/projects/proj-1)'),
      }),
    });
  });

  it('notifies purge failure without related item id', async () => {
    const run = vi.fn().mockRejectedValue(new Error('boom'));

    enqueueDestructiveAction({
      actorId: 'user-2',
      kind: 'purge',
      entityType: 'team',
      entityLabel: 'Platform',
      relatedItemId: null,
      detailHref: '/manager?tab=archived',
      run,
    });

    await vi.waitFor(() => {
      expect(createMock).toHaveBeenCalled();
    });

    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 'user-2',
        type: NotificationTypeEnum.entity_purge_failed,
        related_item_id: null,
        message: expect.stringContaining('boom'),
      }),
    });
  });
});
