import { describe, expect, it } from 'vitest';
import {
  computeBurndownIdeal,
  seriesFromBurndownRollupRows,
} from '@repo/types';

describe('seriesFromBurndownRollupRows', () => {
  it('rebuilds ideal from estimated total and sprint dates', () => {
    const result = seriesFromBurndownRollupRows(
      { start_date: '2026-01-01', end_date: '2026-01-03' },
      [
        {
          bucket_date: '2026-01-01',
          remaining: 10,
          estimated_total: 10,
        },
        {
          bucket_date: '2026-01-02',
          remaining: 5,
          estimated_total: 10,
        },
        {
          bucket_date: '2026-01-03',
          remaining: 0,
          estimated_total: 10,
        },
      ]
    );

    expect(result.estimatedTotal).toBe(10);
    expect(result.series).toHaveLength(3);
    expect(result.series[0]?.ideal).toBe(
      computeBurndownIdeal(10, '2026-01-01', '2026-01-03', '2026-01-01')
    );
    expect(result.series[2]?.remaining).toBe(0);
  });

  it('returns empty series when rollup has no rows', () => {
    expect(
      seriesFromBurndownRollupRows(
        { start_date: '2026-01-01', end_date: '2026-01-02' },
        []
      )
    ).toEqual({ estimatedTotal: 0, series: [] });
  });
});
