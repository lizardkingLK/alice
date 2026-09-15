import { describe, expect, it } from 'vitest';
import { BOARD_WORK_ITEM_STATUSES, type WorkItemStatus } from '@repo/types';
import {
  buildChartsPieFromSample,
  buildChartsStatusPieFromSample,
  CHARTS_SAMPLE_WORK_ITEMS,
  filterChartsSampleByLabelSlice,
  type ChartsSampleWorkItem,
} from '@/app/charts/_components/charts-sample.data';

function item(
  overrides: Partial<ChartsSampleWorkItem> &
    Pick<ChartsSampleWorkItem, 'id' | 'title'>
): ChartsSampleWorkItem {
  return {
    status: 'New',
    type: 'Task',
    priority: 'medium',
    assigneeId: null,
    projectId: '11111111-1111-4111-8111-111111111101',
    group: 'To do',
    description: null,
    dueDate: null,
    storyPoints: null,
    labels: [],
    ...overrides,
  };
}

describe('buildChartsPieFromSample', () => {
  it('matches status wrapper aggregation for the full sample', () => {
    const viaGeneric = buildChartsPieFromSample(
      CHARTS_SAMPLE_WORK_ITEMS,
      'status'
    );
    const viaWrapper = buildChartsStatusPieFromSample(CHARTS_SAMPLE_WORK_ITEMS);

    expect(viaGeneric.total).toBe(CHARTS_SAMPLE_WORK_ITEMS.length);
    expect(viaGeneric.data.map((slice) => slice.key)).toEqual(
      viaWrapper.data.map((slice) => slice.key)
    );
    expect(viaGeneric.data.map((slice) => slice.count)).toEqual(
      viaWrapper.data.map((slice) => slice.count)
    );
  });

  it('orders status slices by BOARD_WORK_ITEM_STATUSES', () => {
    const { data } = buildChartsPieFromSample(
      [
        item({ id: '1', title: 'A', status: 'Done' }),
        item({ id: '2', title: 'B', status: 'New' }),
        item({ id: '3', title: 'C', status: 'Done' }),
      ],
      'status'
    );

    expect(data.map((slice) => slice.key)).toEqual(['New', 'Done']);
    expect(
      data.every((slice) =>
        (BOARD_WORK_ITEM_STATUSES as readonly string[]).includes(slice.key)
      )
    ).toBe(true);
  });

  it('groups by board (project) with project names', () => {
    const { data, total } = buildChartsPieFromSample(
      [
        item({
          id: '1',
          title: 'A',
          projectId: '11111111-1111-4111-8111-111111111101',
        }),
        item({
          id: '2',
          title: 'B',
          projectId: '11111111-1111-4111-8111-111111111102',
        }),
        item({
          id: '3',
          title: 'C',
          projectId: '11111111-1111-4111-8111-111111111101',
        }),
      ],
      'board'
    );

    expect(total).toBe(3);
    expect(data).toHaveLength(2);
    const alice = data.find((slice) => slice.label === 'Alice Platform');
    const demo = data.find((slice) => slice.label === 'Demo Delivery');
    expect(alice?.count).toBe(2);
    expect(demo?.count).toBe(1);
  });

  it('buckets owners and includes Unassigned', () => {
    const ownerId = '22222222-2222-4222-8222-222222222201';
    const { data } = buildChartsPieFromSample(
      [
        item({ id: '1', title: 'A', assigneeId: ownerId }),
        item({ id: '2', title: 'B', assigneeId: null }),
        item({ id: '3', title: 'C', assigneeId: null }),
      ],
      'owner'
    );

    const unassigned = data.find((slice) => slice.key === 'unassigned');
    const owner = data.find((slice) => slice.key === ownerId);
    expect(unassigned?.count).toBe(2);
    expect(unassigned?.label).toBe('Unassigned');
    expect(owner?.count).toBe(1);
    expect(owner?.label).toBe('Alice Admin');
  });

  it('buckets due dates by YYYY-MM and No due date', () => {
    const { data } = buildChartsPieFromSample(
      [
        item({ id: '1', title: 'A', dueDate: '2026-03-15' }),
        item({ id: '2', title: 'B', dueDate: '2026-03-01' }),
        item({ id: '3', title: 'C', dueDate: null }),
      ],
      'dueDate'
    );

    expect(data.find((slice) => slice.key === '2026-03')?.count).toBe(2);
    expect(data.find((slice) => slice.label === 'No due date')?.count).toBe(1);
  });

  it('groups by synthetic group field', () => {
    const { data } = buildChartsPieFromSample(
      [
        item({ id: '1', title: 'A', group: 'Stuck' }),
        item({ id: '2', title: 'B', group: 'Stuck' }),
        item({ id: '3', title: 'C', group: 'To do' }),
      ],
      'group'
    );

    expect(data.find((slice) => slice.key === 'Stuck')?.count).toBe(2);
    expect(data.find((slice) => slice.key === 'To do')?.count).toBe(1);
  });

  it('returns empty data for an empty item list', () => {
    const { data, total } = buildChartsPieFromSample([], 'status');
    expect(total).toBe(0);
    expect(data).toEqual([]);
  });

  it('keeps WorkItemStatus keys for status slices (slice click)', () => {
    const { data } = buildChartsPieFromSample(
      [item({ id: '1', title: 'A', status: 'InProgress' as WorkItemStatus })],
      'status'
    );
    expect(data[0]?.key).toBe('InProgress');
    expect(data[0]?.status).toBe('InProgress');
  });
});

describe('filterChartsSampleByLabelSlice', () => {
  it('filters owner slices and leaves status variety for table grouping', () => {
    const ownerId = '22222222-2222-4222-8222-222222222201';
    const rows = [
      item({ id: '1', title: 'A', assigneeId: ownerId, status: 'New' }),
      item({ id: '2', title: 'B', assigneeId: ownerId, status: 'Done' }),
      item({
        id: '3',
        title: 'C',
        assigneeId: '22222222-2222-4222-8222-222222222202',
        status: 'New',
      }),
    ];

    const filtered = filterChartsSampleByLabelSlice(rows, 'owner', ownerId);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((row) => row.status).sort()).toEqual(['Done', 'New']);
  });

  it('filters unassigned owner bucket', () => {
    const filtered = filterChartsSampleByLabelSlice(
      [
        item({ id: '1', title: 'A', assigneeId: null }),
        item({
          id: '2',
          title: 'B',
          assigneeId: '22222222-2222-4222-8222-222222222201',
        }),
      ],
      'owner',
      'unassigned'
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('1');
  });
});
