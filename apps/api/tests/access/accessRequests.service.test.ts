import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/auth-helpers', () => ({
  requireUserWithRole: vi.fn(async () => ({ email: 'admin@alice.dev' })),
}));

import {
  ACCESS_REQUEST_ALREADY_GRANTED_MESSAGE,
  ACCESS_REQUEST_LIMIT_MESSAGE,
} from '@repo/types';
import { AccessRequestsService } from '../../src/routes/api/accessRequests/accessRequests.service';
import type { AccessRequestsRepository } from '../../src/routes/api/accessRequests/accessRequests.repository';
import type { NotificationsRepository } from '../../src/routes/api/notifications/notifications.repository';

const repository = {
  findById: vi.fn(),
  findPendingByEmail: vi.fn(),
  findLatestByEmail: vi.fn(),
  sumSubmissionCountInWindow: vi.fn(),
  create: vi.fn(),
  updateMessageOnly: vi.fn(),
  updatePendingSubmission: vi.fn(),
  resolveRequest: vi.fn(),
  archiveNotificationsForRequest: vi.fn(),
  rollingWindowStart: vi.fn(() => new Date('2026-01-01T00:00:00.000Z')),
} as unknown as AccessRequestsRepository;

const notificationsRepository = {
  createManyForAccessRequest: vi.fn(),
  createMany: vi.fn(),
} as unknown as NotificationsRepository;

const baseRequest = {
  id: 'req-1',
  requester_email: 'guest@partner.com',
  requester_name: 'Guest',
  message: 'Please add me',
  kind: 'admission' as const,
  status: 'pending' as const,
  request_count: 1,
  requested_project_keys: null,
  resolved_by: null,
  resolved_at: null,
  last_requested_at: '2026-03-01T00:00:00.000Z',
  created_at: '2026-03-01T00:00:00.000Z',
  updated_at: '2026-03-01T00:00:00.000Z',
};

describe('AccessRequestsService.submitFromContact', () => {
  const service = new AccessRequestsService(
    repository,
    notificationsRepository
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repository.findPendingByEmail).mockResolvedValue(null);
    vi.mocked(repository.findLatestByEmail).mockResolvedValue(null);
    vi.mocked(repository.sumSubmissionCountInWindow).mockResolvedValue(0);
    vi.mocked(repository.create).mockResolvedValue(baseRequest);
  });

  it('creates an access request row and notifies admins', async () => {
    const result = await service.submitFromContact({
      email: 'guest@partner.com',
      name: 'Guest',
      title: 'Access request',
      message: 'Please add me',
    });

    expect(result.requestId).toBe('req-1');
    expect(
      notificationsRepository.createManyForAccessRequest
    ).toHaveBeenCalled();
    expect(notificationsRepository.createMany).not.toHaveBeenCalled();
  });

  it('uses legacy notifications for non-access contact subjects', async () => {
    await service.submitFromContact({
      email: 'user@example.com',
      title: 'General question',
      message: 'Hello',
    });

    expect(notificationsRepository.createMany).toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects when the rolling submission cap is reached', async () => {
    vi.mocked(repository.sumSubmissionCountInWindow).mockResolvedValue(3);

    await expect(
      service.submitFromContact({
        email: 'guest@partner.com',
        title: 'Access request',
        message: 'Again',
      })
    ).rejects.toThrow(ACCESS_REQUEST_LIMIT_MESSAGE);
  });

  it('rejects a new admission request when access was already granted', async () => {
    vi.mocked(repository.findLatestByEmail).mockResolvedValue({
      ...baseRequest,
      status: 'granted',
    });

    await expect(
      service.submitFromContact({
        email: 'guest@partner.com',
        title: 'Access request',
        message: 'Again',
      })
    ).rejects.toThrow(ACCESS_REQUEST_ALREADY_GRANTED_MESSAGE);
  });
});

describe('AccessRequestsService.denyAccessRequest', () => {
  const service = new AccessRequestsService(
    repository,
    notificationsRepository
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies a pending request and archives notifications', async () => {
    vi.mocked(repository.findById).mockResolvedValue(baseRequest);

    await service.denyAccessRequest('admin-1', 'req-1');

    expect(repository.resolveRequest).toHaveBeenCalledWith({
      id: 'req-1',
      status: 'denied',
      actorId: 'admin-1',
    });
    expect(repository.archiveNotificationsForRequest).toHaveBeenCalledWith(
      'req-1'
    );
  });
});
