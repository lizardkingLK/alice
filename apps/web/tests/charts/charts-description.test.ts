import { describe, expect, it } from 'vitest';
import { resolveChartsDescription } from '@/app/charts/_helpers/charts-description';
import {
  saveChartWidgetMeta,
  updateChartWidgetFilters,
} from '@/app/charts/_components/charts-board-canvas';
import type { ChartBoardWidgetInstance } from '@/app/charts/_components/charts.types';

describe('resolveChartsDescription', () => {
  it('prefers an explicit description', () => {
    expect(
      resolveChartsDescription({
        description: '  Custom blurb  ',
        title: 'Tasks by status',
        typeId: 'chart',
      })
    ).toBe('Custom blurb');
  });

  it('falls back to title then default type title', () => {
    expect(
      resolveChartsDescription({
        description: null,
        title: 'My board',
      })
    ).toBe('My board');
    expect(
      resolveChartsDescription({
        description: '',
        typeId: 'chart',
      })
    ).toBe('Tasks by status');
    expect(
      resolveChartsDescription({
        description: null,
        typeId: 'burndown',
      })
    ).toBe('Sprint burndown');
  });
});

describe('saveChartWidgetMeta', () => {
  const base: ChartBoardWidgetInstance = {
    instanceId: 'w1',
    typeId: 'chart',
    title: 'Old',
  };

  it('updates title and description', () => {
    const next = saveChartWidgetMeta(
      'w1',
      { title: 'New title', description: ' Hello ' },
      [base]
    );
    expect(next[0]).toEqual({
      instanceId: 'w1',
      typeId: 'chart',
      title: 'New title',
      description: 'Hello',
    });
  });

  it('clears description when null', () => {
    const withDesc: ChartBoardWidgetInstance = {
      ...base,
      description: 'Keep me',
    };
    const next = saveChartWidgetMeta(
      'w1',
      { title: 'Old', description: null },
      [withDesc]
    );
    expect(next[0]?.description).toBeUndefined();
  });

  it('keeps description when other instance fields update', () => {
    const withDesc: ChartBoardWidgetInstance = {
      ...base,
      description: 'Keep me',
    };
    const next = updateChartWidgetFilters(
      'w1',
      {
        mode: 'quick',
        projectId: 'p1',
        rows: [],
        quickSelections: {
          project: 'p1',
          sprint: 'all',
          status: 'all',
          type: 'all',
          assignee: 'all',
          priority: 'all',
        },
      },
      [withDesc]
    );
    expect(next[0]?.description).toBe('Keep me');
  });
});
