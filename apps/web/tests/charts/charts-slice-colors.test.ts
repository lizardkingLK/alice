import { describe, expect, it } from 'vitest';
import {
  chartsSliceColorCssVar,
  isChartsSliceColorToken,
  resolveSliceSwatch,
} from '@/app/charts/_helpers/charts-slice-colors';
import { STATUS_CHART_COLORS } from '@/components/status-distribution-wheel';
import { updateChartWidgetLabelField } from '@/app/charts/_components/charts-board-canvas';
import type { ChartBoardWidgetInstance } from '@/app/charts/_components/charts.types';

describe('resolveSliceSwatch', () => {
  it('uses status theme defaults when no override', () => {
    expect(resolveSliceSwatch('status', 'New', 0)).toBe(
      STATUS_CHART_COLORS.New
    );
    expect(resolveSliceSwatch('status', 'Done', 4)).toBe(
      STATUS_CHART_COLORS.Done
    );
  });

  it('rotates chart tokens for non-status labels', () => {
    expect(resolveSliceSwatch('owner', 'u-1', 0)).toBe('var(--chart-1)');
    expect(resolveSliceSwatch('owner', 'u-2', 5)).toBe('var(--chart-1)');
  });

  it('applies curated token overrides by slice key', () => {
    expect(resolveSliceSwatch('status', 'New', 0, { New: 'chart-4' })).toBe(
      chartsSliceColorCssVar('chart-4')
    );
  });

  it('ignores invalid override tokens', () => {
    expect(resolveSliceSwatch('status', 'New', 0, { New: 'not-a-token' })).toBe(
      STATUS_CHART_COLORS.New
    );
  });

  it('narrows known token ids', () => {
    expect(isChartsSliceColorToken('chart-1')).toBe(true);
    expect(isChartsSliceColorToken('chart-8')).toBe(true);
    expect(isChartsSliceColorToken('chart-9')).toBe(false);
  });
});

describe('updateChartWidgetLabelField', () => {
  it('clears sliceColors when Labels → Columns changes', () => {
    const instances: ChartBoardWidgetInstance[] = [
      {
        instanceId: 'w1',
        typeId: 'chart',
        sliceColors: { New: 'chart-3', Done: 'chart-1' },
      },
    ];

    const next = updateChartWidgetLabelField('w1', 'priority', instances);
    expect(next[0]?.sliceColors).toBeUndefined();
    expect(next[0]?.labelField).toBe('priority');
  });

  it('clears sliceColors when resetting Labels to status', () => {
    const instances: ChartBoardWidgetInstance[] = [
      {
        instanceId: 'w1',
        typeId: 'chart',
        labelField: 'owner',
        sliceColors: { 'u-1': 'chart-2' },
      },
    ];

    const next = updateChartWidgetLabelField('w1', 'status', instances);
    expect(next[0]?.sliceColors).toBeUndefined();
    expect(next[0]?.labelField).toBeUndefined();
  });
});
