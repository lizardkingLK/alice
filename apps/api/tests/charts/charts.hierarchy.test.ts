import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chartHierarchyDrilldownQuerySchema,
  chartHierarchySeriesQuerySchema,
  type Database,
} from '@repo/types';
import {
  buildHierarchyRings,
  ChartsRepository,
} from '../../src/routes/api/charts/charts.repository';
import { ChartsService } from '../../src/routes/api/charts/charts.service';
import type { NotificationsRepository } from '../../src/routes/api/notifications/notifications.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const EPIC_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORY_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STORY_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ORPHAN = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const OUT_OF_SCOPE_PARENT = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

describe('chart hierarchy query schemas', () => {
  it('defaults measure to item_count', () => {
    expect(chartHierarchySeriesQuerySchema.parse({})).toEqual({
      measure: 'item_count',
    });
  });

  it('accepts story_points measure and filters', () => {
    const parsed = chartHierarchySeriesQuerySchema.parse({
      projectId: PROJECT_ID,
      measure: 'story_points',
      sprintId: '44444444-4444-4444-8444-444444444444',
    });
    expect(parsed.measure).toBe('story_points');
    expect(parsed.projectId).toBe(PROJECT_ID);
  });

  it('parses hierarchy drilldown ring + sliceKey', () => {
    const parsed = chartHierarchyDrilldownQuerySchema.parse({
      projectId: PROJECT_ID,
      ring: '1',
      sliceKey: STORY_A,
      parentKey: EPIC_ID,
    });
    expect(parsed).toMatchObject({
      measure: 'item_count',
      ring: 1,
      sliceKey: STORY_A,
      parentKey: EPIC_ID,
      page: 1,
      limit: 20,
    });
  });
});

describe('buildHierarchyRings', () => {
  const titles = new Map([
    [EPIC_ID, 'Epic One'],
    [STORY_A, 'Story A'],
    [STORY_B, 'Story B'],
    [ORPHAN, 'Orphan'],
  ]);

  it('counts every node once; outer children sum under each inner parent', () => {
    const { rings, totalValue } = buildHierarchyRings(
      [
        {
          work_item_id: EPIC_ID,
          parent_id: null,
          item_count: 1,
          story_points: 5,
        },
        {
          work_item_id: STORY_A,
          parent_id: EPIC_ID,
          item_count: 1,
          story_points: 3,
        },
        {
          work_item_id: STORY_B,
          parent_id: EPIC_ID,
          item_count: 1,
          story_points: 2,
        },
      ],
      titles,
      'item_count'
    );

    expect(totalValue).toBe(1);
    expect(rings[0]?.slices).toEqual([
      {
        key: EPIC_ID,
        label: 'Epic One',
        value: 1,
        hasChildren: true,
      },
    ]);
    expect(rings[1]?.slices).toEqual([
      {
        key: STORY_A,
        label: 'Story A',
        value: 1,
        parentKey: EPIC_ID,
        hasChildren: false,
      },
      {
        key: STORY_B,
        label: 'Story B',
        value: 1,
        parentKey: EPIC_ID,
        hasChildren: false,
      },
    ]);
    expect(rings[2]?.slices).toEqual([]);
  });

  it('roots ring 0 under rootWorkItemId for dig navigation', () => {
    const { rings, totalValue } = buildHierarchyRings(
      [
        {
          work_item_id: EPIC_ID,
          parent_id: null,
          item_count: 1,
          story_points: 5,
        },
        {
          work_item_id: STORY_A,
          parent_id: EPIC_ID,
          item_count: 1,
          story_points: 3,
        },
        {
          work_item_id: STORY_B,
          parent_id: EPIC_ID,
          item_count: 1,
          story_points: 2,
        },
      ],
      titles,
      'item_count',
      EPIC_ID
    );

    expect(totalValue).toBe(2);
    expect(rings[0]?.slices.map((s) => s.key).sort()).toEqual(
      [STORY_A, STORY_B].sort()
    );
    expect(rings[0]?.slices.every((s) => s.parentKey === EPIC_ID)).toBe(true);
  });

  it('adds a third ring for grandchildren under stories', () => {
    const taskId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const titlesWithTask = new Map([...titles, [taskId, 'Task Leaf']]);
    const { rings } = buildHierarchyRings(
      [
        {
          work_item_id: EPIC_ID,
          parent_id: null,
          item_count: 1,
          story_points: 5,
        },
        {
          work_item_id: STORY_A,
          parent_id: EPIC_ID,
          item_count: 1,
          story_points: 3,
        },
        {
          work_item_id: taskId,
          parent_id: STORY_A,
          item_count: 1,
          story_points: 1,
        },
      ],
      titlesWithTask,
      'item_count'
    );

    expect(rings).toHaveLength(3);
    expect(rings[2]?.slices).toEqual([
      {
        key: taskId,
        label: 'Task Leaf',
        value: 1,
        parentKey: STORY_A,
        hasChildren: false,
      },
    ]);
  });

  it('sums story points per node without rolling children into the parent', () => {
    const { rings, totalValue } = buildHierarchyRings(
      [
        {
          work_item_id: EPIC_ID,
          parent_id: null,
          item_count: 1,
          story_points: 5,
        },
        {
          work_item_id: STORY_A,
          parent_id: EPIC_ID,
          item_count: 1,
          story_points: 3,
        },
        {
          work_item_id: STORY_B,
          parent_id: EPIC_ID,
          item_count: 1,
          story_points: 2,
        },
      ],
      titles,
      'story_points'
    );

    expect(totalValue).toBe(5);
    expect(rings[0]?.slices[0]?.value).toBe(5);
    expect(rings[1]?.slices.map((s) => s.value).sort()).toEqual([2, 3]);
  });

  it('promotes items whose parent is outside scope to the inner ring', () => {
    const { rings, totalValue } = buildHierarchyRings(
      [
        {
          work_item_id: ORPHAN,
          parent_id: OUT_OF_SCOPE_PARENT,
          item_count: 1,
          story_points: 8,
        },
      ],
      titles,
      'item_count'
    );

    expect(totalValue).toBe(1);
    expect(rings[0]?.slices).toEqual([
      { key: ORPHAN, label: 'Orphan', value: 1, hasChildren: false },
    ]);
    expect(rings[1]?.slices).toEqual([]);
  });
});

const {
  findManyHierarchyMock,
  findManyWorkItemsMock,
  countWorkItemsMock,
  listAccessibleProjectIdsMock,
} = vi.hoisted(() => ({
  findManyHierarchyMock: vi.fn(),
  findManyWorkItemsMock: vi.fn(),
  countWorkItemsMock: vi.fn(),
  listAccessibleProjectIdsMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    work_item_chart_hierarchy_rollups: {
      findMany: findManyHierarchyMock,
    },
    work_items: {
      findMany: findManyWorkItemsMock,
      count: countWorkItemsMock,
    },
  },
}));

vi.mock('../../src/lib/project-access', () => ({
  listAccessibleProjectIds: listAccessibleProjectIdsMock,
}));

describe('ChartsRepository hierarchy', () => {
  const repository = new ChartsRepository({} as SupabaseClient<Database>);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads hierarchy rows and builds rings with titles', async () => {
    findManyHierarchyMock.mockResolvedValue([
      {
        work_item_id: EPIC_ID,
        parent_id: null,
        item_count: 1,
        story_points: 5,
      },
      {
        work_item_id: STORY_A,
        parent_id: EPIC_ID,
        item_count: 1,
        story_points: 3,
      },
    ]);
    findManyWorkItemsMock.mockResolvedValue([
      { id: EPIC_ID, title: 'Epic One' },
      { id: STORY_A, title: 'Story A' },
    ]);

    const result = await repository.sumHierarchySeries({
      projectIds: [PROJECT_ID],
      measure: 'item_count',
      sprintId: '44444444-4444-4444-8444-444444444444',
    });

    expect(findManyHierarchyMock).toHaveBeenCalledWith({
      where: {
        project_id: { in: [PROJECT_ID] },
        sprint_id: '44444444-4444-4444-8444-444444444444',
      },
      select: {
        work_item_id: true,
        parent_id: true,
        item_count: true,
        story_points: true,
      },
    });
    expect(result.totalValue).toBe(1);
    expect(result.rings[0]?.slices[0]?.label).toBe('Epic One');
    expect(result.rings[1]?.slices[0]).toMatchObject({
      key: STORY_A,
      parentKey: EPIC_ID,
    });
  });
});

describe('ChartsService hierarchy', () => {
  const sumHierarchySeriesMock = vi.fn();
  const listHierarchyDrilldownMock = vi.fn();
  const chartsRepository = {
    listAccessibleProjectIds: listAccessibleProjectIdsMock,
    sumHierarchySeries: sumHierarchySeriesMock,
    listHierarchyDrilldown: listHierarchyDrilldownMock,
  } as unknown as ChartsRepository;

  const service = new ChartsService(
    chartsRepository,
    {} as NotificationsRepository
  );

  beforeEach(() => {
    vi.clearAllMocks();
    listAccessibleProjectIdsMock.mockResolvedValue([PROJECT_ID]);
  });

  it('returns hierarchy series after ACL', async () => {
    sumHierarchySeriesMock.mockResolvedValue({
      rings: [
        { level: 0, slices: [{ key: EPIC_ID, label: 'Epic', value: 1 }] },
        { level: 1, slices: [] },
      ],
      totalValue: 1,
    });

    await expect(
      service.getHierarchySeries('user-1', {
        projectId: PROJECT_ID,
        measure: 'item_count',
      })
    ).resolves.toMatchObject({
      projectId: PROJECT_ID,
      measure: 'item_count',
      totalValue: 1,
    });
    expect(sumHierarchySeriesMock).toHaveBeenCalledWith({
      projectIds: [PROJECT_ID],
      measure: 'item_count',
    });
  });

  it('returns hierarchy drilldown for an outer slice', async () => {
    listHierarchyDrilldownMock.mockResolvedValue({
      workItems: [],
      totalCount: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    await expect(
      service.getHierarchyDrilldown('user-1', {
        projectId: PROJECT_ID,
        measure: 'story_points',
        ring: 1,
        sliceKey: STORY_A,
        parentKey: EPIC_ID,
        page: 1,
        limit: 20,
      })
    ).resolves.toMatchObject({
      measure: 'story_points',
      ring: 1,
      sliceKey: STORY_A,
      parentKey: EPIC_ID,
    });
  });
});
