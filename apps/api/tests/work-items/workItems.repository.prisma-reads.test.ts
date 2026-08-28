import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  workItemDetailSelect,
  workItemListSelect,
  workItemListSelectWithDescription,
} from '@repo/types';
import { createWorkItemListRow } from '../factories/work-item.factory';

const { findManyMock, findUniqueMock, countMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  countMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    work_items: {
      findMany: findManyMock,
      findUnique: findUniqueMock,
      count: countMock,
    },
  },
}));

import { WorkItemRepository } from '../../src/routes/api/workItems/workItems.repository';

const db = {} as SupabaseClient<Database>;
const repository = new WorkItemRepository(db);

describe('WorkItemRepository Prisma reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists with shared select, filters, created_at desc, and page slice', async () => {
    const row = createWorkItemListRow();
    findManyMock.mockResolvedValue([row]);
    countMock.mockResolvedValue(1);

    const result = await repository.listPaginated({
      filters: { projectId: row.project_id, type: 'Task' },
      search: 'Ship',
      page: 2,
      limit: 10,
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        project_id: row.project_id,
        type: 'Task',
        record_status: 'active',
        AND: [
          {
            OR: [
              { title: { contains: 'Ship', mode: 'insensitive' } },
              { labels: { array_contains: ['Ship'] } },
            ],
          },
        ],
      },
      select: workItemListSelect,
      orderBy: { created_at: 'desc' },
      skip: 10,
      take: 10,
    });
    expect(countMock).toHaveBeenCalledWith({
      where: {
        project_id: row.project_id,
        type: 'Task',
        record_status: 'active',
        AND: [
          {
            OR: [
              { title: { contains: 'Ship', mode: 'insensitive' } },
              { labels: { array_contains: ['Ship'] } },
            ],
          },
        ],
      },
    });
    expect(result).toEqual({
      workItems: [row],
      totalCount: 1,
      page: 2,
      limit: 10,
      totalPages: 1,
    });
  });

  it('uses the description select when asked', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await repository.listPaginated({
      page: 1,
      limit: 10,
      includeDescription: true,
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        select: workItemListSelectWithDescription,
      })
    );
  });

  it('loads detail by id with the shared detail select', async () => {
    const row = createWorkItemListRow();
    findUniqueMock.mockResolvedValue(row);

    const result = await repository.getDetailById(row.id);

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: row.id },
      select: workItemDetailSelect,
    });
    expect(result).toEqual(row);
  });

  it('returns null when the detail row is missing', async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(
      repository.getDetailById('22222222-2222-4222-8222-222222222222')
    ).resolves.toBeNull();
  });
});
