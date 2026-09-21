import { describe, expect, it } from 'vitest';
import type { LayoutItem } from 'react-grid-layout';
import { reconcileChartBoardLayout } from '@/app/charts/_components/charts-board-canvas';
import type { ChartBoardWidgetInstance } from '@/app/charts/_components/charts.types';

describe('reconcileChartBoardLayout', () => {
  const instances: ChartBoardWidgetInstance[] = [
    { instanceId: 'w1', typeId: 'chart' },
    { instanceId: 'w2', typeId: 'chart' },
  ];

  it('returns empty layout when there are no instances', () => {
    expect(
      reconcileChartBoardLayout([], [{ i: 'x', x: 0, y: 0, w: 4, h: 5 }])
    ).toEqual([]);
  });

  it('rebuilds layout items when react-grid-layout reports an empty layout', () => {
    const next = reconcileChartBoardLayout(instances, []);
    expect(next).toHaveLength(2);
    expect(next.map((item) => item.i)).toEqual(['w1', 'w2']);
    expect(next.every((item) => item.w > 0 && item.h > 0)).toBe(true);
  });

  it('preserves existing positions when layout still matches instances', () => {
    const layout: LayoutItem[] = [
      { i: 'w1', x: 0, y: 0, w: 5, h: 6 },
      { i: 'w2', x: 5, y: 0, w: 5, h: 6 },
    ];
    const next = reconcileChartBoardLayout(instances, layout);
    expect(next[0]).toMatchObject({ i: 'w1', x: 0, y: 0, w: 5, h: 6 });
    expect(next[1]).toMatchObject({ i: 'w2', x: 5, y: 0, w: 5, h: 6 });
  });
});
