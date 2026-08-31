import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseAllowlistProjectKeys,
  syncAllowlistProjectMembers,
} from '../../src/lib/sync-allowlist-project-members';

const {
  findFirstMock,
  findManyMock,
  findUniqueMock,
  createMock,
  updateMock,
  removeMemberMock,
} = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  removeMemberMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    users: { findFirst: findFirstMock },
    projects: { findMany: findManyMock },
    project_members: {
      findUnique: findUniqueMock,
      create: createMock,
      update: updateMock,
    },
  },
}));

const projectsRepository = {
  removeMember: removeMemberMock,
} as never;

describe('parseAllowlistProjectKeys', () => {
  it('returns unique trimmed keys', () => {
    expect(parseAllowlistProjectKeys([' SG ', 'SG', 'DEMO'])).toEqual([
      'SG',
      'DEMO',
    ]);
  });
});

describe('syncAllowlistProjectMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstMock.mockResolvedValue({ id: 'user-1' });
    findManyMock.mockResolvedValue([
      { id: 'proj-nurl', key: 'NURL' },
      { id: 'proj-epeasy', key: 'EPEASY' },
    ]);
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue(undefined);
    removeMemberMock.mockResolvedValue(undefined);
  });

  it('creates memberships for newly checked project keys', async () => {
    await syncAllowlistProjectMembers({
      actorId: 'admin-1',
      email: 'guest@partner.com',
      previousKeys: [],
      nextKeys: ['NURL', 'EPEASY'],
      entryActive: true,
      projectsRepository,
    });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(removeMemberMock).not.toHaveBeenCalled();
  });

  it('removes memberships for unchecked project keys', async () => {
    await syncAllowlistProjectMembers({
      actorId: 'admin-1',
      email: 'guest@partner.com',
      previousKeys: ['NURL', 'EPEASY'],
      nextKeys: ['NURL'],
      entryActive: true,
      projectsRepository,
    });

    expect(removeMemberMock).toHaveBeenCalledWith('proj-epeasy', 'user-1');
  });

  it('reactivates inactive memberships idempotently', async () => {
    findUniqueMock.mockResolvedValue({ status: 'inactive' });

    await syncAllowlistProjectMembers({
      actorId: 'admin-1',
      email: 'guest@partner.com',
      previousKeys: ['NURL'],
      nextKeys: ['NURL'],
      entryActive: true,
      projectsRepository,
    });

    expect(createMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(removeMemberMock).not.toHaveBeenCalled();
  });

  it('skips when the allowlisted user does not exist yet', async () => {
    findFirstMock.mockResolvedValue(null);

    await syncAllowlistProjectMembers({
      actorId: 'admin-1',
      email: 'guest@partner.com',
      previousKeys: [],
      nextKeys: ['NURL'],
      entryActive: true,
      projectsRepository,
    });

    expect(createMock).not.toHaveBeenCalled();
    expect(removeMemberMock).not.toHaveBeenCalled();
  });

  it('removes all previous keys when the allowlist entry is inactive', async () => {
    await syncAllowlistProjectMembers({
      actorId: 'admin-1',
      email: 'guest@partner.com',
      previousKeys: ['NURL', 'EPEASY'],
      nextKeys: ['NURL', 'EPEASY'],
      entryActive: false,
      projectsRepository,
    });

    expect(createMock).not.toHaveBeenCalled();
    expect(removeMemberMock).toHaveBeenCalledTimes(2);
  });
});
