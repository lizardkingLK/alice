import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { chartDrilldownItemSelect } from '@repo/types';
import { createWorkItemListRow } from '../factories/work-item.factory';

const {
  groupByMock,
  findManyWorkItemsMock,
  countWorkItemsMock,
  findUniqueProjectMock,
  findManyUsersMock,
  listAccessibleProjectIdsMock,
} = vi.hoisted(() => ({
  groupByMock: vi.fn(),
  findManyWorkItemsMock: vi.fn(),
  countWorkItemsMock: vi.fn(),
  findUniqueProjectMock: vi.fn(),
  findManyUsersMock: vi.fn(),
  listAccessibleProjectIdsMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    work_item_chart_rollups: {
      groupBy: groupByMock,
    },
    work_items: {
      findMany: findManyWorkItemsMock,
      count: countWorkItemsMock,
    },
    projects: {
      findUnique: findUniqueProjectMock,
    },
    users: {
      findMany: findManyUsersMock,
    },
  },
}));

vi.mock('../../src/lib/project-access', () => ({
  listAccessibleProjectIds: listAccessibleProjectIdsMock,
}));

import { ChartsRepository } from '../../src/routes/api/charts/charts.repository';

const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const ASSIGNEE_ID = '22222222-2222-4222-8222-222222222222';

const db = {} as SupabaseClient<Database>;
const repository = new ChartsRepository(db);

describe('ChartsRepository analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('groups rollup item_count by status with optional date + sprint filters', async () => {
    groupByMock.mockResolvedValue([
      { status: 'Done', _sum: { item_count: 4 } },
      { status: 'New', _sum: { item_count: 2 } },
    ]);

    const result = await repository.sumSeries({
      projectId: PROJECT_ID,
      labelField: 'status',
      from: '2026-01-01',
      to: '2026-01-31',
      sprintId: '44444444-4444-4444-8444-444444444444',
    });

    expect(groupByMock).toHaveBeenCalledWith({
      by: ['status'],
      where: {
        project_id: PROJECT_ID,
        sprint_id: '44444444-4444-4444-8444-444444444444',
        bucket_date: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lte: new Date('2026-01-31T00:00:00.000Z'),
        },
      },
      _sum: { item_count: true },
      orderBy: { _sum: { item_count: 'desc' } },
    });
    expect(result).toEqual({
      totalCount: 6,
      slices: [
        { key: 'Done', label: 'Done', count: 4 },
        { key: 'New', label: 'New', count: 2 },
      ],
    });
  });

  it('resolves owner labels and maps null assignee to empty slice key', async () => {
    groupByMock.mockResolvedValue([
      { assignee_id: ASSIGNEE_ID, _sum: { item_count: 3 } },
      { assignee_id: null, _sum: { item_count: 1 } },
    ]);
    findManyUsersMock.mockResolvedValue([
      { id: ASSIGNEE_ID, name: 'Ada', email: 'ada@alice.dev' },
    ]);

    const result = await repository.sumSeries({
      projectId: PROJECT_ID,
      labelField: 'owner',
    });

    expect(groupByMock).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['assignee_id'] })
    );
    expect(result.slices).toEqual([
      { key: ASSIGNEE_ID, label: 'Ada', count: 3 },
      { key: '', label: 'Unassigned', count: 1 },
    ]);
  });

  it('paginates drilldown work items with slice + created_at filters', async () => {
    const row = createWorkItemListRow();
    findManyWorkItemsMock.mockResolvedValue([row]);
    countWorkItemsMock.mockResolvedValue(1);

    const result = await repository.listDrilldown({
      projectId: PROJECT_ID,
      labelField: 'status',
      sliceKey: 'New',
      from: '2026-01-01',
      to: '2026-01-02',
      page: 1,
      limit: 20,
    });

    expect(findManyWorkItemsMock).toHaveBeenCalledWith({
      where: {
        project_id: PROJECT_ID,
        record_status: 'active',
        created_at: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lt: new Date('2026-01-03T00:00:00.000Z'),
        },
        status: 'New',
      },
      select: chartDrilldownItemSelect,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 20,
    });
    expect(result).toEqual({
      workItems: [row],
      totalCount: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it('filters drilldown unassigned owner with null assignee_id', async () => {
    findManyWorkItemsMock.mockResolvedValue([]);
    countWorkItemsMock.mockResolvedValue(0);

    await repository.listDrilldown({
      projectId: PROJECT_ID,
      labelField: 'owner',
      sliceKey: '',
      page: 2,
      limit: 10,
    });

    expect(findManyWorkItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignee_id: null,
        }),
        skip: 10,
        take: 10,
      })
    );
  });
});
