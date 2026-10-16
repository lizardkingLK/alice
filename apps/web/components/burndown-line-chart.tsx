'use client';

import type { ReactNode } from 'react';
import {
  CartesianGrid,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  XAxis,
  YAxis,
  type ChartConfig,
} from '@repo/ui/components/ui/chart';
import type { SprintBurndownPayload } from '@repo/types';
import { ChartViewport } from '@/components/chart-viewport';
import { cn } from '@repo/ui/lib/utils';

export type BurndownPoint = SprintBurndownPayload['series'][number];

export type BurndownAxisRange = {
  readonly startDate: string;
  readonly endDate: string;
};

export const BURNDOWN_LINE_CHART_CONFIG = {
  remaining: { label: 'Remaining', color: 'var(--chart-1)' },
  ideal: { label: 'Ideal', color: 'var(--muted-foreground)' },
} satisfies ChartConfig;

export function defaultBurndownAxisRange(): BurndownAxisRange {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function buildEmptyBurndownAxisScaffold(
  range: BurndownAxisRange
): BurndownPoint[] {
  return [
    { date: range.startDate, remaining: null, ideal: 0 },
    { date: range.endDate, remaining: null, ideal: 0 },
  ];
}

export function computeBurndownYAxisMax(
  points: readonly BurndownPoint[],
  estimatedTotal = 0
): number {
  const peak = points.reduce((max, point) => {
    const next = Math.max(point.ideal, point.remaining ?? 0);
    return Math.max(max, next);
  }, 0);

  return Math.max(peak, estimatedTotal, 10);
}

export function formatBurndownTick(isoDate: string): string {
  const [yRaw, mRaw, dRaw] = isoDate.split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = Number(dRaw);

  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return isoDate;
  }

  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function applyBurndownPayload(burndown: SprintBurndownPayload | null): {
  series: BurndownPoint[];
  estimatedTotal: number;
  axisRange: BurndownAxisRange;
} {
  if (!burndown) {
    return {
      series: [],
      estimatedTotal: 0,
      axisRange: defaultBurndownAxisRange(),
    };
  }

  return {
    series: burndown.series,
    estimatedTotal: burndown.estimatedTotal,
    axisRange: {
      startDate: burndown.sprint.startDate,
      endDate: burndown.sprint.endDate,
    },
  };
}

type BurndownLineChartProps = {
  readonly series: readonly BurndownPoint[];
  readonly estimatedTotal?: number;
  readonly axisRange?: BurndownAxisRange;
  readonly emptyHint?: string | null;
  readonly settleMs?: number;
  readonly className?: string;
  readonly viewportClassName?: string;
};

export function BurndownLineChart({
  series,
  estimatedTotal = 0,
  axisRange,
  emptyHint,
  settleMs,
  className,
  viewportClassName,
}: BurndownLineChartProps): ReactNode {
  const hasData = series.length > 0;
  const range = axisRange ?? defaultBurndownAxisRange();
  const chartData = hasData ? series : buildEmptyBurndownAxisScaffold(range);
  const yAxisMax = computeBurndownYAxisMax(chartData, estimatedTotal);

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
      <ChartViewport
        config={BURNDOWN_LINE_CHART_CONFIG}
        settleMs={settleMs}
        className={cn('min-h-0 w-full flex-1', viewportClassName)}
      >
        <LineChart
          data={[...chartData]}
          margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={!hasData}
            tickMargin={8}
            tickFormatter={(value) =>
              typeof value === 'string' ? formatBurndownTick(value) : ''
            }
          />
          <YAxis
            tickLine={false}
            axisLine={!hasData}
            width={28}
            domain={[0, yAxisMax]}
          />
          {hasData ? (
            <>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="ideal"
                stroke="var(--color-ideal)"
                strokeDasharray="4 4"
                strokeWidth={2}
                dot={false}
                // Avoid Recharts 3.8 resize animation clipping the line end.
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="remaining"
                stroke="var(--color-remaining)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </>
          ) : null}
        </LineChart>
      </ChartViewport>
      {emptyHint ? (
        <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm">
          {emptyHint}
        </p>
      ) : null}
    </div>
  );
}
