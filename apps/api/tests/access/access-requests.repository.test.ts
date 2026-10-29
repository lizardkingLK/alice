import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  transactionMock,
  requestUpdateManyMock,
  requestFindUniqueMock,
  notificationUpdateManyMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  requestUpdateManyMock: vi.fn(),
  requestFindUniqueMock: vi.fn(),
  notificationUpdateManyMock: vi.fn(),
}));

const transactionClient = {
  access_requests: {
    updateMany: requestUpdateManyMock,
    findUnique: requestFindUniqueMock,
  },
  notifications: {
    updateMany: notificationUpdateManyMock,
  },
};

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

import { AccessRequestsRepository } from '../../src/routes/api/access-requests/access-requests.repository';

const resolvedRow = {
  id: 'req-1',
  requester_email: 'guest@partner.com',
  requester_name: 'Guest',
  message: 'Please add me',
  kind: 'admission' as const,
  status: 'granted' as const,
  request_count: 1,
  requested_project_keys: null,
  resolved_by: 'admin-1',
  resolved_at: new Date('2026-03-02T00:00:00.000Z'),
  last_requested_at: new Date('2026-03-01T00:00:00.000Z'),
  created_at: new Date('2026-03-01T00:00:00.000Z'),
  updated_at: new Date('2026-03-02T00:00:00.000Z'),
};

describe('AccessRequestsRepository.resolvePendingAndArchive', () => {
  const repository = new AccessRequestsRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(
      async (operation: (transaction: typeof transactionClient) => unknown) =>
        operation(transactionClient)
    );
  });

  it('conditionally resolves pending state and archives notifications atomically', async () => {
    requestUpdateManyMock.mockResolvedValue({ count: 1 });
    notificationUpdateManyMock.mockResolvedValue({ count: 2 });
    requestFindUniqueMock.mockResolvedValue(resolvedRow);

    const result = await repository.resolvePendingAndArchive({
      id: 'req-1',
      status: 'granted',
      actorId: 'admin-1',
    });

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(requestUpdateManyMock).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'pending' },
      data: {
        status: 'granted',
        resolved_by: 'admin-1',
        resolved_at: expect.any(Date),
      },
    });
    expect(notificationUpdateManyMock).toHaveBeenCalledWith({
      where: { related_item_id: 'req-1' },
      data: {
        status: 'archived',
        read_status: true,
        updated_at: expect.any(Date),
      },
    });
    expect(result?.status).toBe('granted');
  });

  it('returns null without side effects when another resolver wins', async () => {
    requestUpdateManyMock.mockResolvedValue({ count: 0 });

    await expect(
      repository.resolvePendingAndArchive({
        id: 'req-1',
        status: 'denied',
        actorId: 'admin-2',
      })
    ).resolves.toBeNull();

    expect(notificationUpdateManyMock).not.toHaveBeenCalled();
    expect(requestFindUniqueMock).not.toHaveBeenCalled();
  });

  it('propagates notification persistence failure from the transaction', async () => {
    requestUpdateManyMock.mockResolvedValue({ count: 1 });
    notificationUpdateManyMock.mockRejectedValue(
      new Error('notification update failed')
    );

    await expect(
      repository.resolvePendingAndArchive({
        id: 'req-1',
        status: 'granted',
        actorId: 'admin-1',
      })
    ).rejects.toThrow('notification update failed');

    expect(requestFindUniqueMock).not.toHaveBeenCalled();
  });
});
