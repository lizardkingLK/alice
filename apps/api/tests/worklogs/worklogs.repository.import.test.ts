import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const { transactionMock, createManyMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  createManyMock: vi.fn(),
}));

const transactionClient = {
  work_item_worklogs: {
    createMany: createManyMock,
  },
};

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

import { WorklogsRepository } from '../../src/routes/api/worklogs/worklogs.repository';

const db = {} as SupabaseClient<Database>;
const repository = new WorklogsRepository(db);

describe('WorklogsRepository atomic import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(
      async (operation: (transaction: typeof transactionClient) => unknown) =>
        operation(transactionClient)
    );
  });

  it('creates all imported rows in one Prisma transaction', async () => {
    createManyMock.mockResolvedValue({ count: 2 });

    const count = await repository.createManyAtomic([
      {
        workItemId: '22222222-2222-4222-8222-222222222222',
        actorId: '11111111-1111-4111-8111-111111111111',
        loggedHours: 1.5,
        loggedAtIso: '2026-11-05T08:00:00.000Z',
        comment: 'First row',
      },
      {
        workItemId: '22222222-2222-4222-8222-222222222222',
        actorId: '11111111-1111-4111-8111-111111111111',
        loggedHours: 2,
        loggedAtIso: '2026-11-05T23:00:00.000Z',
        comment: null,
      },
    ]);

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(createManyMock).toHaveBeenCalledWith({
      data: [
        {
          work_item_id: '22222222-2222-4222-8222-222222222222',
          user_id: '11111111-1111-4111-8111-111111111111',
          logged_hours: 1.5,
          logged_at: new Date('2026-11-05T08:00:00.000Z'),
          comment: 'First row',
          status: 'active',
          created_by: '11111111-1111-4111-8111-111111111111',
          updated_by: '11111111-1111-4111-8111-111111111111',
        },
        {
          work_item_id: '22222222-2222-4222-8222-222222222222',
          user_id: '11111111-1111-4111-8111-111111111111',
          logged_hours: 2,
          logged_at: new Date('2026-11-05T23:00:00.000Z'),
          comment: null,
          status: 'active',
          created_by: '11111111-1111-4111-8111-111111111111',
          updated_by: '11111111-1111-4111-8111-111111111111',
        },
      ],
    });
    expect(count).toBe(2);
  });

  it('propagates a row persistence failure from the transaction', async () => {
    createManyMock.mockRejectedValue(new Error('Database row rejected'));

    await expect(
      repository.createManyAtomic([
        {
          workItemId: '22222222-2222-4222-8222-222222222222',
          actorId: '11111111-1111-4111-8111-111111111111',
          loggedHours: 1,
          loggedAtIso: '2026-11-05T08:00:00.000Z',
          comment: null,
        },
      ])
    ).rejects.toThrow('Database row rejected');

    expect(transactionMock).toHaveBeenCalledOnce();
  });
});
