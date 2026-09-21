import { describe, expect, it } from 'vitest';
import type { ChartSeriesSlice, WorkItemListRow } from '@repo/types';
import {
  buildChartsPieFromSeries,
  filterChartDrilldownTableItems,
  isChartSeriesLabelField,
  resolveChartAnalyticsDimensionFilters,
  resolveChartAnalyticsProjectId,
  resolveChartAnalyticsSprintId,
  workItemListRowToChartTableItem,
} from '@/app/charts/_helpers/charts-analytics.ui';
import type { ChartsWidgetFilterDraft } from '@/app/charts/_components/charts-sample.data';
import { createChartWidgetFiltersFromDefaults } from '@/app/charts/_helpers/charts-widget-defaults';
import { ALL_PROJECTS_ID } from '@/app/board/_helpers/board-defaults-storage';

function slice(key: string, count: number, label = key): ChartSeriesSlice {
  return { key, label, count };
}

const ALL_QUICK = {
  project: 'all',
  sprint: 'all',
  status: 'all',
  type: 'all',
  assignee: 'all',
  priority: 'all',
} as const;

describe('charts analytics UI helpers', () => {
  it('detects live series label fields', () => {
    expect(isChartSeriesLabelField('status')).toBe(true);
    expect(isChartSeriesLabelField('owner')).toBe(true);
    expect(isChartSeriesLabelField('type')).toBe(true);
    expect(isChartSeriesLabelField('dueDate')).toBe(false);
    expect(isChartSeriesLabelField('group')).toBe(false);
  });

  it('resolves a concrete project id from filters (null = all projects)', () => {
    const draft = {
      mode: 'quick',
      projectId: '33333333-3333-4333-8333-333333333333',
      rows: [],
      quickSelections: {
        ...ALL_QUICK,
        project: '33333333-3333-4333-8333-333333333333',
      },
    } satisfies ChartsWidgetFilterDraft;

    expect(resolveChartAnalyticsProjectId(draft)).toBe(
      '33333333-3333-4333-8333-333333333333'
    );
    expect(
      resolveChartAnalyticsProjectId({
        ...draft,
        projectId: 'all',
        quickSelections: { ...draft.quickSelections, project: 'all' },
      })
    ).toBeNull();
    expect(resolveChartAnalyticsProjectId(null)).toBeNull();
  });

  it('resolves quick-filter project from quickSelections when projectId is stale', () => {
    expect(
      resolveChartAnalyticsProjectId({
        mode: 'quick',
        projectId: 'all',
        rows: [],
        quickSelections: {
          ...ALL_QUICK,
          project: '33333333-3333-4333-8333-333333333333',
        },
      })
    ).toBe('33333333-3333-4333-8333-333333333333');
  });

  it('resolves optional sprint id from filters', () => {
    expect(
      resolveChartAnalyticsSprintId({
        mode: 'quick',
        projectId: 'p1',
        sprintId: '44444444-4444-4444-8444-444444444444',
        rows: [],
        quickSelections: {
          ...ALL_QUICK,
          project: 'p1',
          sprint: '44444444-4444-4444-8444-444444444444',
        },
      })
    ).toBe('44444444-4444-4444-8444-444444444444');
    expect(
      resolveChartAnalyticsSprintId({
        mode: 'quick',
        projectId: 'p1',
        rows: [],
        quickSelections: { ...ALL_QUICK, project: 'p1', sprint: 'all' },
      })
    ).toBeUndefined();
    expect(resolveChartAnalyticsSprintId(null)).toBeUndefined();
  });

  it('resolves quick-filter sprint from quickSelections when sprintId is stale', () => {
    expect(
      resolveChartAnalyticsSprintId({
        mode: 'quick',
        projectId: 'p1',
        rows: [],
        quickSelections: {
          ...ALL_QUICK,
          project: 'p1',
          sprint: '44444444-4444-4444-8444-444444444444',
        },
      })
    ).toBe('44444444-4444-4444-8444-444444444444');
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
      sprint_id: 's-1',
      assignee: {
        id: 'u-1',
        name: 'Ada',
        email: 'ada@alice.dev',
        profile_picture: null,
      },
      project: { id: 'p-1', key: 'ALP', name: 'Alpha' },
      sprint: { id: 's-1', name: 'Sprint 1' },
    } as WorkItemListRow & {
      project: { id: string; key: string; name: string };
      sprint: { id: string; name: string };
    };

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
      projectName: 'Alpha',
      sprintId: 's-1',
      sprintName: 'Sprint 1',
    });
  });

  it('filters drilldown table items by task title or assignee name', () => {
    const items = [
      {
        id: '1',
        title: 'Alpha',
        status: 'New' as const,
        type: 'Task' as const,
        priority: 'medium' as const,
        assigneeId: 'a',
        assigneeName: 'Ada Lovelace',
        assigneeAvatar: null,
        projectId: 'p',
        projectName: null,
        sprintId: null,
        sprintName: null,
      },
      {
        id: '2',
        title: 'Beta',
        status: 'New' as const,
        type: 'Task' as const,
        priority: 'medium' as const,
        assigneeId: 'b',
        assigneeName: 'Grace Hopper',
        assigneeAvatar: null,
        projectId: 'p',
        projectName: null,
        sprintId: null,
        sprintName: null,
      },
    ];

    expect(
      filterChartDrilldownTableItems(items, { search: 'alp' }).map((i) => i.id)
    ).toEqual(['1']);
    expect(
      filterChartDrilldownTableItems(items, { search: 'hop' }).map((i) => i.id)
    ).toEqual(['2']);
    expect(
      filterChartDrilldownTableItems(items, { search: 'ada' }).map((i) => i.id)
    ).toEqual(['1']);
  });

  it('seeds widget filters from workspace defaults including All projects', () => {
    expect(createChartWidgetFiltersFromDefaults(null)).toMatchObject({
      mode: 'quick',
      projectId: 'all',
      quickSelections: { project: 'all', sprint: 'all' },
    });
    expect(
      createChartWidgetFiltersFromDefaults({
        projectId: ALL_PROJECTS_ID,
        sprintId: null,
      }).projectId
    ).toBe('all');
    expect(
      createChartWidgetFiltersFromDefaults({
        projectId: '33333333-3333-4333-8333-333333333333',
        sprintId: '44444444-4444-4444-8444-444444444444',
      })
    ).toMatchObject({
      projectId: '33333333-3333-4333-8333-333333333333',
      sprintId: '44444444-4444-4444-8444-444444444444',
      quickSelections: {
        project: '33333333-3333-4333-8333-333333333333',
        sprint: '44444444-4444-4444-8444-444444444444',
      },
    });
  });

  it('maps quick filter selections to analytics dimension params', () => {
    expect(
      resolveChartAnalyticsDimensionFilters({
        mode: 'quick',
        projectId: 'all',
        rows: [],
        quickSelections: {
          ...ALL_QUICK,
          status: 'Done',
          type: 'Task',
          assignee: 'unassigned',
          priority: 'high',
        },
      })
    ).toEqual({
      status: 'Done',
      type: 'Task',
      priority: 'high',
      assigneeId: '',
    });
  });

  it('maps advanced equality rows to analytics dimension params', () => {
    expect(
      resolveChartAnalyticsDimensionFilters({
        mode: 'advanced',
        projectId: 'all',
        rows: [
          {
            id: '1',
            column: 'status',
            condition: 'is',
            value: 'New',
          },
          {
            id: '2',
            column: 'type',
            condition: 'is',
            value: 'Task',
          },
          {
            id: '3',
            column: 'priority',
            condition: 'is-not',
            value: 'low',
          },
        ],
        quickSelections: { ...ALL_QUICK },
      })
    ).toEqual({
      status: 'New',
      type: 'Task',
    });
  });
});
