'use client';

import type { ReactNode } from 'react';
import {
  Cell,
  ChartTooltip,
  ChartTooltipContent,
  Pie,
  PieChart,
  type ChartConfig,
} from '@repo/ui/components/ui/chart';
import { BOARD_WORK_ITEM_STATUSES, type WorkItemStatus } from '@repo/types';
import { STATUS_META } from '@/app/work-items/_helpers/work-item-status';
import { ChartViewport } from '@/components/chart-viewport';
import { cn } from '@repo/ui/lib/utils';

type BoardStatus = (typeof BOARD_WORK_ITEM_STATUSES)[number];

/**
 * Theme chart tokens for status distribution wheels (Overview + Charts).
 * Keeps status segments aligned with the shared dashboard palette.
 */
export const STATUS_CHART_COLORS: Record<BoardStatus, string> = {
  New: 'var(--chart-1)',
  ToDo: 'var(--chart-2)',
  InProgress: 'var(--chart-3)',
  Testing: 'var(--chart-4)',
  Done: 'var(--chart-5)',
};

export type StatusDistributionSlice = {
  readonly status: BoardStatus;
  readonly label: string;
  readonly count: number;
  readonly fill: string;
};

export function buildStatusDistributionChartConfig(
  statuses: readonly BoardStatus[] = BOARD_WORK_ITEM_STATUSES
): ChartConfig {
  const config: ChartConfig = {
    count: { label: 'Count' },
  };

  for (const status of statuses) {
    config[status] = {
      label: STATUS_META[status]?.label ?? status,
      color: STATUS_CHART_COLORS[status],
    };
  }

  return config;
}

export function buildStatusDistributionSlices(
  counts: Readonly<Partial<Record<WorkItemStatus, number>>>
): StatusDistributionSlice[] {
  return BOARD_WORK_ITEM_STATUSES.filter(
    (status) => (counts[status] ?? 0) > 0
  ).map((status) => ({
    status,
    label: STATUS_META[status]?.label ?? status,
    count: counts[status] ?? 0,
    fill: `var(--color-${status})`,
  }));
}

type StatusDistributionWheelProps = {
  readonly data: readonly StatusDistributionSlice[];
  readonly config: ChartConfig;
  readonly className?: string;
  readonly chartClassName?: string;
  readonly square?: boolean;
  readonly settleMs?: number;
  readonly innerRadius?: number | `${number}%`;
  readonly outerRadius?: number | `${number}%`;
  readonly paddingAngle?: number;
  readonly strokeWidth?: number;
  readonly showTooltip?: boolean;
  readonly isAnimationActive?: boolean;
  /** Rendered inside the chart container (e.g. ChartLegend). */
  readonly legend?: ReactNode;
  // eslint-disable-next-line no-unused-vars -- slice click callback
  readonly onSliceClick?: (status: BoardStatus) => void;
};

/**
 * Shared status donut/wheel used by Overview and Charts.
 */
export function StatusDistributionWheel({
  data,
  config,
  className,
  chartClassName,
  square = true,
  settleMs = 0,
  innerRadius = '48%',
  outerRadius = '78%',
  paddingAngle = 2,
  strokeWidth = 2,
  showTooltip = true,
  isAnimationActive = true,
  legend,
  onSliceClick,
}: Readonly<StatusDistributionWheelProps>) {
  const interactive = Boolean(onSliceClick);

  return (
    <ChartViewport
      square={square}
      config={config}
      settleMs={settleMs}
      className={cn('relative min-h-0 min-w-0', className)}
      chartClassName={chartClassName}
    >
      <PieChart>
        {showTooltip ? (
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel nameKey="status" />}
          />
        ) : null}
        <Pie
          data={[...data]}
          dataKey="count"
          nameKey="status"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          strokeWidth={strokeWidth}
          paddingAngle={paddingAngle}
          isAnimationActive={isAnimationActive}
          onClick={(_data, index) => {
            const entry = data[index];
            if (entry && onSliceClick) {
              onSliceClick(entry.status);
            }
          }}
          className={interactive ? 'cursor-pointer outline-none' : undefined}
        >
          {data.map((entry) => (
            <Cell
              key={entry.status}
              fill={entry.fill}
              className={
                interactive ? 'cursor-pointer outline-none' : undefined
              }
              style={interactive ? { cursor: 'pointer' } : undefined}
            />
          ))}
        </Pie>
        {legend}
      </PieChart>
    </ChartViewport>
  );
}
