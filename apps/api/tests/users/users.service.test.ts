import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findByIdMock,
  deactivateGuardedMock,
  updateMock,
  updateUserByIdMock,
  selectSingleMock,
} = vi.hoisted(() => ({
  findByIdMock: vi.fn(),
  deactivateGuardedMock: vi.fn(),
  updateMock: vi.fn(),
  updateUserByIdMock: vi.fn(),
  selectSingleMock: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: selectSingleMock,
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

vi.mock('../../src/routes/api/users/users.repository', () => ({
  usersRepository: {
    findById: findByIdMock,
    deactivateGuarded: deactivateGuardedMock,
    update: updateMock,
  },
}));

import { UsersService } from '../../src/routes/api/users/users.service';

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
    selectSingleMock.mockResolvedValue({
      data: { role: 'admin' },
      error: null,
    });
  });

  it('deactivates another user as admin via toggle', async () => {
    findByIdMock.mockResolvedValue(baseUser);
    deactivateGuardedMock.mockResolvedValue({ ...baseUser, active: false });

    const result = await service.toggleUserActive(
      'admin-1',
      'user-1',
      false,
      baseUser.updated_at
    );

    expect(result.active).toBe(false);
    expect(deactivateGuardedMock).toHaveBeenCalledWith(
      'user-1',
      'admin-1',
      baseUser.updated_at
    );
    expect(updateUserByIdMock).toHaveBeenCalledWith('user-1', {
      ban_duration: '87600h',
    });
  });

  it('allows self-deactivate via the same toggle route', async () => {
    findByIdMock.mockResolvedValue(baseUser);
    deactivateGuardedMock.mockResolvedValue({ ...baseUser, active: false });

    await service.toggleUserActive(
      'user-1',
      'user-1',
      false,
      baseUser.updated_at
    );

    expect(deactivateGuardedMock).toHaveBeenCalled();
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
    deactivateGuardedMock.mockRejectedValue(
      new Error('Cannot deactivate the last active admin.')
    );

    await expect(
      service.toggleUserActive('admin-1', 'admin-1', false, baseUser.updated_at)
    ).rejects.toThrow('Cannot deactivate the last active admin.');

    expect(updateMock).not.toHaveBeenCalled();
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it('rejects deactivating another account as a self actor', async () => {
    await expect(
      service.deactivateUser('user-1', { type: 'self', actorId: 'user-2' })
    ).rejects.toThrow('You can only deactivate your own account.');

    expect(findByIdMock).not.toHaveBeenCalled();
    expect(deactivateGuardedMock).not.toHaveBeenCalled();
  });

  it('rejects non-admin deactivating another user', async () => {
    selectSingleMock.mockResolvedValue({
      data: { role: 'member' },
      error: null,
    });

    await expect(
      service.deactivateUser('user-1', { type: 'admin', actorId: 'member-1' })
    ).rejects.toThrow('Only administrators can perform this action.');

    expect(findByIdMock).not.toHaveBeenCalled();
  });

  it('rejects when target user is missing', async () => {
    findByIdMock.mockResolvedValue(null);

    await expect(
      service.deactivateUser('missing', {
        type: 'self',
        actorId: 'missing',
      })
    ).rejects.toThrow('User not found.');
  });

  it('propagates Auth ban failures after deactivate', async () => {
    findByIdMock.mockResolvedValue(baseUser);
    deactivateGuardedMock.mockResolvedValue({ ...baseUser, active: false });
    updateUserByIdMock.mockResolvedValue({
      error: { message: 'ban failed' },
    });

    await expect(
      service.toggleUserActive('admin-1', 'user-1', false, baseUser.updated_at)
    ).rejects.toThrow(/session revocation failed/i);
  });

  it('is idempotent when already inactive', async () => {
    findByIdMock.mockResolvedValue({ ...baseUser, active: false });

    const result = await service.deactivateUser('user-1', {
      type: 'self',
      actorId: 'user-1',
    });

    expect(result.active).toBe(false);
    expect(deactivateGuardedMock).not.toHaveBeenCalled();
    expect(updateUserByIdMock).toHaveBeenCalled();
  });
});
