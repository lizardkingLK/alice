import { describe, expect, it } from 'vitest';
import type { ChartSeriesSlice, WorkItemListRow } from '@repo/types';
import {
  buildChartsPieFromSeries,
  filterChartDrilldownTableItems,
  isChartSeriesLabelField,
  resolveChartAnalyticsProjectId,
  workItemListRowToChartTableItem,
} from '@/app/charts/_helpers/charts-analytics.ui';
import type { ChartsWidgetFilterDraft } from '@/app/charts/_components/charts-sample.data';

function slice(key: string, count: number, label = key): ChartSeriesSlice {
  return { key, label, count };
}

describe('charts analytics UI helpers', () => {
  it('detects live series label fields', () => {
    expect(isChartSeriesLabelField('status')).toBe(true);
    expect(isChartSeriesLabelField('owner')).toBe(true);
    expect(isChartSeriesLabelField('type')).toBe(true);
    expect(isChartSeriesLabelField('dueDate')).toBe(false);
    expect(isChartSeriesLabelField('group')).toBe(false);
  });

  it('resolves a concrete project id from filters', () => {
    const draft = {
      mode: 'quick',
      projectId: '33333333-3333-4333-8333-333333333333',
      rows: [],
      quickSelections: {
        project: '33333333-3333-4333-8333-333333333333',
        status: 'all',
        type: 'all',
        assignee: 'all',
        priority: 'all',
      },
    } satisfies ChartsWidgetFilterDraft;

    expect(resolveChartAnalyticsProjectId(draft)).toBe(
      '33333333-3333-4333-8333-333333333333'
    );
    expect(
      resolveChartAnalyticsProjectId({ ...draft, projectId: 'all' })
    ).toBeNull();
    expect(resolveChartAnalyticsProjectId(null)).toBeNull();
  });

  it('builds pie slices from series with status board order', () => {
    const { data, total } = buildChartsPieFromSeries(
      [slice('Done', 2), slice('New', 1)],
      'status'
    );

    expect(total).toBe(3);
    expect(data.map((entry) => entry.key)).toEqual(['New', 'Done']);
    expect(data[0]?.percent).toBe('33.3%');
  });

  it('maps null owner slice key through the pie builder', () => {
    const { data } = buildChartsPieFromSeries(
      [slice('', 4, 'Unassigned'), slice('user-1', 1, 'Ada')],
      'owner'
    );

    expect(data.find((entry) => entry.key === '')?.label).toBe('Unassigned');
    expect(data.find((entry) => entry.key === 'user-1')?.label).toBe('Ada');
  });

  it('maps work item list rows to table items', () => {
    const row = {
      id: 'wi-1',
      title: 'Ship charts',
      status: 'New',
      type: 'Task',
      priority: 'medium',
      assignee_id: 'u-1',
      project_id: 'p-1',
      assignee: {
        id: 'u-1',
        name: 'Ada',
        email: 'ada@alice.dev',
        profile_picture: null,
      },
    } as WorkItemListRow;

    expect(workItemListRowToChartTableItem(row)).toEqual({
      id: 'wi-1',
      title: 'Ship charts',
      status: 'New',
      type: 'Task',
      priority: 'medium',
      assigneeId: 'u-1',
      assigneeName: 'Ada',
      assigneeAvatar: null,
      projectId: 'p-1',
    });
  });

  it('filters drilldown table items by search and assignee', () => {
    const items = [
      {
        id: '1',
        title: 'Alpha',
        status: 'New' as const,
        type: 'Task' as const,
        priority: 'medium' as const,
        assigneeId: 'a',
        assigneeName: 'A',
        assigneeAvatar: null,
        projectId: 'p',
      },
      {
        id: '2',
        title: 'Beta',
        status: 'New' as const,
        type: 'Task' as const,
        priority: 'medium' as const,
        assigneeId: 'b',
        assigneeName: 'B',
        assigneeAvatar: null,
        projectId: 'p',
      },
    ];

    expect(
      filterChartDrilldownTableItems(items, { search: 'alp' }).map((i) => i.id)
    ).toEqual(['1']);
    expect(
      filterChartDrilldownTableItems(items, { assigneeId: 'b' }).map(
        (i) => i.id
      )
    ).toEqual(['2']);
  });
});
