import { beforeEach, describe, expect, it, vi } from 'vitest';
import { integrationListSelect, type Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    integrations: {
      findMany: findManyMock,
    },
  },
}));

import { IntegrationsRepository } from '../../src/routes/api/integrations/integrations.repository';

const db = {} as SupabaseClient<Database>;
const repository = new IntegrationsRepository(db);

describe('IntegrationsRepository.listActiveChatModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects active AI integrations only, regardless of provider', async () => {
    findManyMock.mockResolvedValue([]);

    await expect(repository.listActiveChatModels()).resolves.toEqual([]);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        category: 'ai_agent',
        status: 'active',
      },
      select: integrationListSelect,
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  });
});
