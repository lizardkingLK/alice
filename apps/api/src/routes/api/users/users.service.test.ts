import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findByIdMock,
  countOtherActiveAdminsMock,
  updateMock,
  updateUserByIdMock,
} = vi.hoisted(() => ({
  findByIdMock: vi.fn(),
  countOtherActiveAdminsMock: vi.fn(),
  updateMock: vi.fn(),
  updateUserByIdMock: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null,
          }),
        })),
      })),
    })),
    auth: {
      admin: {
        updateUserById: updateUserByIdMock,
      },
    },
  },
}));

vi.mock('./users.repository', () => ({
  usersRepository: {
    findById: findByIdMock,
    countOtherActiveAdmins: countOtherActiveAdminsMock,
    update: updateMock,
  },
}));

import { UsersService } from './users.service';

const baseUser = {
  id: 'user-1',
  name: 'Pat',
  email: 'pat@example.com',
  role: 'member' as const,
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('UsersService.deactivateUser / toggleUserActive', () => {
  const service = new UsersService();

  beforeEach(() => {
    vi.clearAllMocks();
    updateUserByIdMock.mockResolvedValue({ error: null });
  });

  it('deactivates another user as admin via toggle', async () => {
    findByIdMock.mockResolvedValue(baseUser);
    updateMock.mockResolvedValue({ ...baseUser, active: false });

    const result = await service.toggleUserActive(
      'admin-1',
      'user-1',
      false,
      baseUser.updated_at
    );

    expect(result.active).toBe(false);
    expect(updateMock).toHaveBeenCalledWith(
      'user-1',
      { active: false },
      'admin-1',
      baseUser.updated_at
    );
    expect(updateUserByIdMock).toHaveBeenCalledWith('user-1', {
      ban_duration: '87600h',
    });
  });

  it('allows self-deactivate via the same toggle route', async () => {
    findByIdMock.mockResolvedValue(baseUser);
    updateMock.mockResolvedValue({ ...baseUser, active: false });

    await service.toggleUserActive(
      'user-1',
      'user-1',
      false,
      baseUser.updated_at
    );

    expect(updateMock).toHaveBeenCalled();
    expect(updateUserByIdMock).toHaveBeenCalledWith('user-1', {
      ban_duration: '87600h',
    });
  });

  it('rejects deactivating the last active admin', async () => {
    findByIdMock.mockResolvedValue({
      ...baseUser,
      id: 'admin-1',
      role: 'admin',
    });
    countOtherActiveAdminsMock.mockResolvedValue(0);

    await expect(
      service.toggleUserActive('admin-1', 'admin-1', false, baseUser.updated_at)
    ).rejects.toThrow('Cannot deactivate the last active admin.');

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('is idempotent when already inactive', async () => {
    findByIdMock.mockResolvedValue({ ...baseUser, active: false });

    const result = await service.deactivateUser('user-1', {
      type: 'self',
      actorId: 'user-1',
    });

    expect(result.active).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
    expect(updateUserByIdMock).toHaveBeenCalled();
  });
});
