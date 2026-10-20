'use client';

import { useRef, type ReactNode } from 'react';
import type { PrefetchedChartSeriesEntry } from '@/app/charts/_helpers/charts-series-cache-key';
import { seedChartSeriesCache } from '@/app/charts/_hooks/use-chart-widget-analytics';

type ChartSeriesCacheSeedProps = {
  readonly entries: readonly PrefetchedChartSeriesEntry[];
  readonly children: ReactNode;
};

/**
 * Synchronously seeds the chart series Map before child widget hooks run
 * their first effect — avoids N post-mount analytics GETs for RSC-prefetched
 * dashboard slide widgets.
 */
export function ChartSeriesCacheSeed({
  entries,
  children,
}: Readonly<ChartSeriesCacheSeedProps>) {
  const seeded = useRef(false);
  if (!seeded.current && entries.length > 0) {
    seedChartSeriesCache(entries);
    seeded.current = true;
  }
  return children;
}
