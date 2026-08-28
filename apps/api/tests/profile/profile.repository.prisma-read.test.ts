import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@repo/types';
import { profileDetailSelect } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createProfileDetailRow } from '../factories/profile.factory';

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    users: {
      findUnique: findUniqueMock,
    },
  },
}));

import { ProfileRepository } from '../../src/routes/api/profile/profile.repository';

const db = {} as SupabaseClient<Database>;
const repository = new ProfileRepository(db);

describe('ProfileRepository Prisma detail read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the signed-in user with shared profileDetailSelect', async () => {
    const row = createProfileDetailRow();
    findUniqueMock.mockResolvedValue(row);

    const result = await repository.getProfileUserPrisma(row.id);

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: row.id },
      select: profileDetailSelect,
    });
    expect(result).toEqual(row);
  });

  it('returns null when the user does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);

    const result = await repository.getProfileUserPrisma(
      '22222222-2222-4222-8222-222222222222'
    );

    expect(result).toBeNull();
  });
});
