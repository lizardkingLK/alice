import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import { userListSelect, type Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { OptimisticLockError } from '../../src/lib/optimistic-lock';
import { UsersRepository } from '../../src/routes/api/users/users.repository';

const { updateManyMock, findUniqueMock } = vi.hoisted(() => ({
  updateManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    users: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: updateManyMock,
      findUnique: findUniqueMock,
    },
  },
}));

const mockDb = {
  from: vi.fn(),
} as unknown as SupabaseClient<Database>;

const baseUser = {
  id: 'user-1',
  name: 'Pat',
  email: 'pat@example.com',
  role: 'member' as const,
  active: false,
  membership_status: 'active' as const,
  profile_picture: null,
  cover_picture: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-08-31T06:00:00.123Z'),
  created_by: null,
  updated_by: null,
};

describe('UsersRepository.update', () => {
  const repository = new UsersRepository(mockDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a millisecond range lock so Prisma matches Postgres microsecond timestamps', async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    findUniqueMock.mockResolvedValue({
      ...baseUser,
      active: true,
    });

    const result = await repository.update(
      'user-1',
      { active: true },
      'admin-1',
      '2026-08-31T06:00:00.123456+00:00'
    );

    expect(result.active).toBe(true);
    expect(result.updated_at).toBe('2026-08-31T06:00:00.123Z');
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: userListSelect,
    });
    const lockMs = new Date('2026-08-31T06:00:00.123456+00:00').getTime();
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
        updated_at: {
          gte: new Date(lockMs),
          lt: new Date(lockMs + 1),
        },
      },
      data: expect.objectContaining({
        active: true,
        updated_by: 'admin-1',
      }),
    });
  });

  it('throws OptimisticLockError when Prisma updateMany matches zero rows', async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    findUniqueMock.mockResolvedValue(baseUser);

    await expect(
      repository.update(
        'user-1',
        { active: true },
        'admin-1',
        '2026-01-01T00:00:00.000Z'
      )
    ).rejects.toBeInstanceOf(OptimisticLockError);
  });
});
