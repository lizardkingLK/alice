import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@repo/types';
import { workLogListSelect } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createWorkLogListRow } from '../factories/worklog.factory';

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    work_item_worklogs: {
      findMany: findManyMock,
    },
  },
}));

import { WorklogsRepository } from '../../src/routes/api/worklogs/worklogs.repository';

const db = {} as SupabaseClient<Database>;
const repository = new WorklogsRepository(db);

describe('WorklogsRepository Prisma list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists active work logs by work item with shared select and logged_at desc', async () => {
    const row = createWorkLogListRow();
    findManyMock.mockResolvedValue([row]);

    const result = await repository.listByWorkItemId(row.work_item_id);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        work_item_id: row.work_item_id,
        status: 'active',
      },
      orderBy: { logged_at: 'desc' },
      select: workLogListSelect,
    });
    expect(result).toEqual([row]);
  });
});
