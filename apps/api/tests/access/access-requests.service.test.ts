import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/auth-helpers', () => ({
  requireUserWithRole: vi.fn(async () => ({ email: 'admin@alice.dev' })),
}));

const { findManyProjectsMock, notifyAllowlistedEmailMock } = vi.hoisted(() => ({
  findManyProjectsMock: vi.fn(),
  notifyAllowlistedEmailMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    projects: {
      findMany: findManyProjectsMock,
    },
  },
}));

vi.mock(
  '../../src/routes/api/access-allowlist/notify-allowlisted-email',
  () => ({
    notifyAllowlistedEmail: notifyAllowlistedEmailMock,
  })
);

import {
  ACCESS_REQUEST_ALREADY_GRANTED_MESSAGE,
  ACCESS_REQUEST_LIMIT_MESSAGE,
} from '@repo/types';
import { AccessRequestsService } from '../../src/routes/api/access-requests/access-requests.service';
import type { AccessRequestsRepository } from '../../src/routes/api/access-requests/access-requests.repository';
import type { NotificationsRepository } from '../../src/routes/api/notifications/notifications.repository';

const repository = {
  findById: vi.fn(),
  findPendingByEmail: vi.fn(),
  findLatestByEmail: vi.fn(),
  sumSubmissionCountInWindow: vi.fn(),
  create: vi.fn(),
  updateMessageOnly: vi.fn(),
  updatePendingSubmission: vi.fn(),
  resolvePendingAndArchive: vi.fn(),
  resolveFromStatusAndArchive: vi.fn(),
  archiveNotificationsForRequest: vi.fn(),
  deleteById: vi.fn(),
  rollingWindowStart: vi.fn(() => new Date('2026-01-01T00:00:00.000Z')),
} as unknown as AccessRequestsRepository;

const projectMemberFindUnique = vi.fn();
const projectMemberCreate = vi.fn();
const transactionClient = {
  project_members: {
    findUnique: projectMemberFindUnique,
    create: projectMemberCreate,
  },
} as never;

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
      requestedProjectKeys: 'acme, beta',
    });

    expect(result.requestId).toBe('req-1');
    expect(repository.create).toHaveBeenCalledWith({
      requesterEmail: 'guest@partner.com',
      requesterName: 'Guest',
      message: 'Please add me',
      requestedProjectKeys: ['ACME', 'BETA'],
    });
    expect(
      notificationsRepository.createManyForAccessRequest
    ).toHaveBeenCalled();
    expect(notificationsRepository.createMany).not.toHaveBeenCalled();
  });

  it('updates message and project keys inside the idempotency window', async () => {
    vi.mocked(repository.findPendingByEmail).mockResolvedValue({
      ...baseRequest,
      last_requested_at: new Date().toISOString(),
    });

    const result = await service.submitFromContact({
      email: 'guest@partner.com',
      title: 'Access request',
      message: 'Need ACME only',
      requestedProjectKeys: ['acme'],
    });

    expect(result.requestId).toBe('req-1');
    expect(repository.updateMessageOnly).toHaveBeenCalledWith(
      'req-1',
      'Need ACME only',
      ['ACME']
    );
    expect(
      notificationsRepository.createManyForAccessRequest
    ).not.toHaveBeenCalled();
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
  const accessAllowlistRepository = {
    withTransaction: vi.fn(),
    findActiveDomainByValue: vi.fn(),
    findEmailByValue: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const projectsRepository = {
    listAccessibleProjectIds: vi.fn(),
    listActiveMemberProjectIds: vi.fn(),
    listMembers: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
  };
  const usersRepository = {
    findByEmail: vi.fn(),
  };

  const service = new AccessRequestsService(
    repository,
    notificationsRepository,
    {
      accessAllowlistRepository: accessAllowlistRepository as never,
      projectsRepository: projectsRepository as never,
      usersRepository: usersRepository as never,
    }
  );

  beforeEach(() => {
    vi.clearAllMocks();
    accessAllowlistRepository.withTransaction.mockImplementation(
      async (operation: (transaction: never) => Promise<unknown>) =>
        operation(transactionClient)
    );
    accessAllowlistRepository.findEmailByValue.mockResolvedValue(null);
    projectsRepository.listAccessibleProjectIds.mockResolvedValue(['proj-1']);
    projectsRepository.listActiveMemberProjectIds.mockResolvedValue([]);
  });

  it('denies a pending request and archives notifications', async () => {
    vi.mocked(repository.findById).mockResolvedValue(baseRequest);
    vi.mocked(repository.resolvePendingAndArchive).mockResolvedValue({
      ...baseRequest,
      status: 'denied',
    });

    await service.denyAccessRequest('admin-1', 'req-1');

    expect(projectsRepository.removeMember).not.toHaveBeenCalled();
    expect(accessAllowlistRepository.update).not.toHaveBeenCalled();
    expect(repository.resolvePendingAndArchive).toHaveBeenCalledWith({
      id: 'req-1',
      status: 'denied',
      actorId: 'admin-1',
    });
  });

  it('does not overwrite a request resolved by a concurrent action', async () => {
    vi.mocked(repository.findById).mockResolvedValue(baseRequest);
    vi.mocked(repository.resolvePendingAndArchive).mockResolvedValue(null);

    await expect(service.denyAccessRequest('admin-1', 'req-1')).rejects.toThrow(
      'This access request is already resolved.'
    );
  });

  it('revokes shared memberships and deactivates email allowlist for granted', async () => {
    vi.mocked(repository.findById).mockResolvedValue({
      ...baseRequest,
      status: 'granted',
    });
    usersRepository.findByEmail.mockResolvedValue({
      id: 'user-guest',
      email: 'guest@partner.com',
    });
    projectsRepository.listAccessibleProjectIds.mockResolvedValue([
      'proj-1',
      'proj-2',
    ]);
    projectsRepository.listActiveMemberProjectIds.mockResolvedValue([
      'proj-1',
      'proj-other',
    ]);
    accessAllowlistRepository.findEmailByValue.mockResolvedValue({
      id: 'al-1',
      value: 'guest@partner.com',
      status: 'active',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(repository.resolveFromStatusAndArchive).mockResolvedValue({
      ...baseRequest,
      status: 'denied',
    });

    await service.denyAccessRequest('admin-1', 'req-1');

    expect(projectsRepository.removeMember).toHaveBeenCalledWith(
      'proj-1',
      'user-guest'
    );
    expect(projectsRepository.removeMember).not.toHaveBeenCalledWith(
      'proj-other',
      expect.anything()
    );
    expect(accessAllowlistRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'al-1',
        status: 'inactive',
      }),
      transactionClient
    );
    expect(repository.resolveFromStatusAndArchive).toHaveBeenCalledWith(
      {
        id: 'req-1',
        expectedStatus: 'granted',
        status: 'denied',
        actorId: 'admin-1',
      },
      transactionClient
    );
  });
});

describe('AccessRequestsService.deleteAccessRequest', () => {
  const service = new AccessRequestsService(
    repository,
    notificationsRepository
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('archives notifications then hard-deletes the request', async () => {
    vi.mocked(repository.findById).mockResolvedValue(baseRequest);

    await service.deleteAccessRequest('admin-1', 'req-1');

    expect(repository.archiveNotificationsForRequest).toHaveBeenCalledWith(
      'req-1'
    );
    expect(repository.deleteById).toHaveBeenCalledWith('req-1');
  });

  it('rejects when the request is missing', async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(
      service.deleteAccessRequest('admin-1', 'missing')
    ).rejects.toThrow('Access request not found');
    expect(repository.deleteById).not.toHaveBeenCalled();
  });
});

describe('AccessRequestsService.grantAccessRequest', () => {
  const accessAllowlistRepository = {
    withTransaction: vi.fn(),
    findActiveDomainByValue: vi.fn(),
    findEmailByValue: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const projectsRepository = {
    listAccessibleProjectIds: vi.fn(),
    listActiveMemberProjectIds: vi.fn(),
    listMembers: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
  };
  const usersRepository = {
    findByEmail: vi.fn(),
  };

  const service = new AccessRequestsService(
    repository,
    notificationsRepository,
    {
      accessAllowlistRepository: accessAllowlistRepository as never,
      projectsRepository: projectsRepository as never,
      usersRepository: usersRepository as never,
    }
  );

  beforeEach(() => {
    vi.clearAllMocks();
    accessAllowlistRepository.withTransaction.mockImplementation(
      async (operation: (transaction: never) => Promise<unknown>) =>
        operation(transactionClient)
    );
    vi.mocked(repository.findById).mockResolvedValue(baseRequest);
    vi.mocked(repository.resolvePendingAndArchive).mockResolvedValue({
      ...baseRequest,
      status: 'granted',
    });
    projectsRepository.listAccessibleProjectIds.mockResolvedValue([
      'proj-1',
      'proj-2',
    ]);
    findManyProjectsMock.mockImplementation(
      async (args: { where?: { id?: { in?: string[] } } }) => {
        const ids = args.where?.id?.in ?? [];
        const all = [
          { id: 'proj-1', key: 'ACME' },
          { id: 'proj-2', key: 'BETA' },
        ];
        return all.filter((row) => ids.includes(row.id));
      }
    );
    projectMemberFindUnique.mockResolvedValue(null);
    projectMemberCreate.mockResolvedValue({});
    usersRepository.findByEmail.mockResolvedValue({
      id: 'user-guest',
      email: 'guest@partner.com',
    });
    accessAllowlistRepository.findEmailByValue.mockResolvedValue(null);
    accessAllowlistRepository.create.mockResolvedValue({
      value: 'guest@partner.com',
    });
    notifyAllowlistedEmailMock.mockResolvedValue(undefined);
  });

  it('creates email allowlist + members when no covering domain', async () => {
    accessAllowlistRepository.findActiveDomainByValue.mockResolvedValue(null);

    await service.grantAccessRequest('admin-1', 'req-1', {
      projects: [
        { projectId: 'proj-1', addMember: true },
        { projectId: 'proj-2', addMember: false },
      ],
    });

    expect(accessAllowlistRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'email',
        value: 'guest@partner.com',
        allowed_project_ids: ['ACME', 'BETA'],
      }),
      transactionClient
    );
    expect(notifyAllowlistedEmailMock).toHaveBeenCalledWith(
      'guest@partner.com'
    );
    expect(projectMemberCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        project_id: 'proj-1',
        user_id: 'user-guest',
        created_by: 'admin-1',
      }),
    });
    expect(projectMemberCreate).toHaveBeenCalledTimes(1);
    expect(repository.resolvePendingAndArchive).toHaveBeenCalledWith(
      {
        id: 'req-1',
        status: 'granted',
        actorId: 'admin-1',
      },
      transactionClient
    );
    expect(
      vi.mocked(repository.resolvePendingAndArchive).mock.invocationCallOrder[0]
    ).toBeLessThan(notifyAllowlistedEmailMock.mock.invocationCallOrder[0]!);
  });

  it('keeps a committed grant when admission email delivery fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    accessAllowlistRepository.findActiveDomainByValue.mockResolvedValue(null);
    notifyAllowlistedEmailMock.mockRejectedValue(
      new Error('email unavailable')
    );

    await expect(
      service.grantAccessRequest('admin-1', 'req-1', {
        projects: [{ projectId: 'proj-1', addMember: true }],
      })
    ).resolves.toBeUndefined();

    expect(repository.resolvePendingAndArchive).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      'error. allowlist admission email failed:',
      'email unavailable'
    );
    consoleError.mockRestore();
  });

  it('does not email again when an active email allowlist row is updated', async () => {
    accessAllowlistRepository.findActiveDomainByValue.mockResolvedValue(null);
    accessAllowlistRepository.findEmailByValue.mockResolvedValue({
      id: 'al-1',
      value: 'guest@partner.com',
      status: 'active',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    await service.grantAccessRequest('admin-1', 'req-1', {
      projects: [{ projectId: 'proj-1', addMember: true }],
    });

    expect(accessAllowlistRepository.update).toHaveBeenCalledOnce();
    expect(notifyAllowlistedEmailMock).not.toHaveBeenCalled();
  });

  it('does not email when a concurrent resolver wins approval', async () => {
    accessAllowlistRepository.findActiveDomainByValue.mockResolvedValue(null);
    vi.mocked(repository.resolvePendingAndArchive).mockResolvedValue(null);

    await expect(
      service.grantAccessRequest('admin-1', 'req-1', {
        projects: [{ projectId: 'proj-1', addMember: true }],
      })
    ).rejects.toThrow('This access request is already resolved.');

    expect(notifyAllowlistedEmailMock).not.toHaveBeenCalled();
  });

  it('rejects when the transactional request email no longer matches', async () => {
    accessAllowlistRepository.findActiveDomainByValue.mockResolvedValue(null);
    vi.mocked(repository.findById)
      .mockResolvedValueOnce(baseRequest)
      .mockResolvedValueOnce({
        ...baseRequest,
        requester_email: 'other@partner.com',
      });

    await expect(
      service.grantAccessRequest('admin-1', 'req-1', {
        projects: [{ projectId: 'proj-1', addMember: true }],
      })
    ).rejects.toThrow('This access request is already resolved.');

    expect(accessAllowlistRepository.create).not.toHaveBeenCalled();
    expect(repository.resolvePendingAndArchive).not.toHaveBeenCalled();
    expect(notifyAllowlistedEmailMock).not.toHaveBeenCalled();
  });

  it('skips email allowlist and forces members when covering domain', async () => {
    accessAllowlistRepository.findActiveDomainByValue.mockResolvedValue({
      id: 'domain-1',
      value: 'partner.com',
    });

    await service.grantAccessRequest('admin-1', 'req-1', {
      projects: [{ projectId: 'proj-1', addMember: false }],
    });

    expect(accessAllowlistRepository.create).not.toHaveBeenCalled();
    expect(projectMemberCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        project_id: 'proj-1',
        user_id: 'user-guest',
      }),
    });
    expect(repository.resolvePendingAndArchive).toHaveBeenCalledWith(
      {
        id: 'req-1',
        status: 'granted',
        actorId: 'admin-1',
      },
      transactionClient
    );
  });

  it('rejects inaccessible projects', async () => {
    projectsRepository.listAccessibleProjectIds.mockResolvedValue(['proj-1']);

    await expect(
      service.grantAccessRequest('admin-1', 'req-1', {
        projects: [{ projectId: 'proj-2', addMember: true }],
      })
    ).rejects.toThrow('You can only grant projects you can access');
  });

  it('rejects already-granted requests', async () => {
    vi.mocked(repository.findById).mockResolvedValue({
      ...baseRequest,
      status: 'granted',
    });

    await expect(
      service.grantAccessRequest('admin-1', 'req-1', {
        projects: [{ projectId: 'proj-1', addMember: true }],
      })
    ).rejects.toThrow('Only pending or denied');
  });

  it('re-grants a denied request by reactivating email allowlist', async () => {
    vi.mocked(repository.findById).mockResolvedValue({
      ...baseRequest,
      status: 'denied',
    });
    accessAllowlistRepository.findActiveDomainByValue.mockResolvedValue(null);
    accessAllowlistRepository.findEmailByValue.mockResolvedValue({
      id: 'al-1',
      value: 'guest@partner.com',
      status: 'inactive',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(repository.resolveFromStatusAndArchive).mockResolvedValue({
      ...baseRequest,
      status: 'granted',
    });

    await service.grantAccessRequest('admin-1', 'req-1', {
      projects: [{ projectId: 'proj-1', addMember: true }],
    });

    expect(accessAllowlistRepository.create).not.toHaveBeenCalled();
    expect(accessAllowlistRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'al-1',
        status: 'active',
        allowed_project_ids: ['ACME'],
      }),
      transactionClient
    );
    expect(notifyAllowlistedEmailMock).toHaveBeenCalledWith(
      'guest@partner.com'
    );
    expect(repository.resolveFromStatusAndArchive).toHaveBeenCalledWith(
      {
        id: 'req-1',
        expectedStatus: 'denied',
        status: 'granted',
        actorId: 'admin-1',
      },
      transactionClient
    );
  });
});

describe('AccessRequestsService.markGrantedForRequest', () => {
  const service = new AccessRequestsService(
    repository,
    notificationsRepository
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('grants the expected pending request', async () => {
    const transaction = {} as never;
    vi.mocked(repository.findById).mockResolvedValue(baseRequest);
    vi.mocked(repository.resolvePendingAndArchive).mockResolvedValue({
      ...baseRequest,
      status: 'granted',
    });

    await service.markGrantedForRequest(
      'admin-1',
      'req-1',
      ' GUEST@PARTNER.COM ',
      transaction
    );

    expect(repository.findById).toHaveBeenCalledWith('req-1', transaction);
    expect(repository.resolvePendingAndArchive).toHaveBeenCalledWith(
      {
        id: 'req-1',
        status: 'granted',
        actorId: 'admin-1',
      },
      transaction
    );
  });

  it('rejects an already resolved request', async () => {
    vi.mocked(repository.findById).mockResolvedValue({
      ...baseRequest,
      status: 'denied',
    });

    await expect(
      service.markGrantedForRequest('admin-1', 'req-1', 'guest@partner.com')
    ).rejects.toThrow('This access request is already resolved.');

    expect(repository.resolvePendingAndArchive).not.toHaveBeenCalled();
  });

  it('rejects when a concurrent resolver wins the conditional update', async () => {
    vi.mocked(repository.findById).mockResolvedValue(baseRequest);
    vi.mocked(repository.resolvePendingAndArchive).mockResolvedValue(null);

    await expect(
      service.markGrantedForRequest('admin-1', 'req-1', 'guest@partner.com')
    ).rejects.toThrow('This access request is already resolved.');
  });

  it('rejects approval for a different requester email', async () => {
    vi.mocked(repository.findById).mockResolvedValue(baseRequest);

    await expect(
      service.markGrantedForRequest('admin-1', 'req-1', 'other@partner.com')
    ).rejects.toThrow('Access request does not match the allowlist email.');

    expect(repository.resolvePendingAndArchive).not.toHaveBeenCalled();
  });
});
