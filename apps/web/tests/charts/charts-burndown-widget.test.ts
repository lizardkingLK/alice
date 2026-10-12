import { describe, expect, it } from 'vitest';
import {
  CHARTS_BURNDOWN_DEFAULT_TITLE,
  defaultTitleForChartWidgetType,
  isBurndownWidgetType,
} from '@/app/charts/_helpers/charts-burndown-widget';
import { isChartWidgetAvailable } from '@/app/charts/_components/charts-widget-catalog';
import { layoutSizeForWidgetType } from '@/app/charts/_components/charts-board-canvas';

describe('charts burndown widget catalog', () => {
  it('treats burndown and data-over-time as burndown widgets', () => {
    expect(isBurndownWidgetType('burndown')).toBe(true);
    expect(isBurndownWidgetType('data-over-time')).toBe(true);
    expect(isBurndownWidgetType('chart')).toBe(false);
  });

  it('marks burndown catalog entries as available', () => {
    expect(isChartWidgetAvailable('burndown')).toBe(true);
    expect(isChartWidgetAvailable('data-over-time')).toBe(true);
    expect(isChartWidgetAvailable('gantt')).toBe(false);
  });

  it('uses chart-sized layout for burndown widgets', () => {
    expect(layoutSizeForWidgetType('burndown')).toEqual(
      layoutSizeForWidgetType('chart')
    );
    expect(layoutSizeForWidgetType('data-over-time')).toEqual(
      layoutSizeForWidgetType('chart')
    );
  });

  it('resolves default titles for chart and burndown widgets', () => {
    expect(CHARTS_BURNDOWN_DEFAULT_TITLE).toBe('Sprint burndown');
    expect(defaultTitleForChartWidgetType('chart')).toBe('Tasks by status');
    expect(defaultTitleForChartWidgetType('burndown')).toBe(
      CHARTS_BURNDOWN_DEFAULT_TITLE
    );
    expect(defaultTitleForChartWidgetType('data-over-time')).toBe(
      CHARTS_BURNDOWN_DEFAULT_TITLE
    );
  });
});
