'use client';

import { useMemo } from 'react';
import type { WorkItemStatus } from '@repo/types';
import {
  Cell,
  ChartTooltip,
  ChartTooltipContent,
  Pie,
  PieChart,
} from '@repo/ui/components/ui/chart';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import {
  buildChartsStatusPieFromSample,
  type ChartsSampleWorkItem,
} from '@/app/charts/_components/charts-sample.data';
import { ChartViewport } from '@/components/chart-viewport';

type ChartsStatusPiePreviewProps = {
  readonly className?: string;
  readonly size?: 'card' | 'dialog' | 'split';
  readonly workItems?: readonly ChartsSampleWorkItem[];
  /** When set, pie slices and legend rows are clickable. */
  // eslint-disable-next-line no-unused-vars -- slice click callback
  readonly onSliceClick?: (status: WorkItemStatus) => void;
};

export function ChartsStatusPiePreview({
  className,
  size = 'card',
  workItems,
  onSliceClick,
}: Readonly<ChartsStatusPiePreviewProps>) {
  const isDialog = size === 'dialog';
  const isSplit = size === 'split';
  const { data, config, total } = useMemo(
    () => buildChartsStatusPieFromSample(workItems),
    [workItems]
  );

  const interactive = Boolean(onSliceClick);

  let pieMaxClass =
    'mx-auto aspect-square h-full max-h-full max-w-[min(100%,14rem)]';
  if (isDialog) {
    pieMaxClass =
      'mx-auto aspect-square h-full max-h-[min(100%,22rem)] max-w-[min(100%,22rem)]';
  } else if (isSplit) {
    pieMaxClass =
      'mx-auto aspect-square h-full max-h-[min(100%,18rem)] max-w-[min(100%,18rem)]';
  }

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 items-center justify-center',
        isDialog || isSplit ? 'gap-8 px-4 py-2' : 'gap-3 px-1 py-1',
        className
      )}
    >
      <ChartViewport
        square
        config={config}
        className={cn('relative min-h-0 min-w-0 flex-1', pieMaxClass)}
      >
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel nameKey="status" />}
          />
          <Pie
            data={[...data]}
            dataKey="count"
            nameKey="status"
            innerRadius={0}
            outerRadius="90%"
            strokeWidth={0}
            paddingAngle={1}
            onClick={(_data, index) => {
              const entry = data[index];
              if (entry && onSliceClick) {
                onSliceClick(entry.status as WorkItemStatus);
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
        </PieChart>
      </ChartViewport>

      <ul
        className={cn(
          'flex shrink-0 flex-col justify-center',
          isDialog || isSplit ? 'min-w-36 gap-3' : 'min-w-28 gap-1.5'
        )}
        aria-label="Status legend"
      >
        {data.length === 0 ? (
          <li className="text-muted-foreground text-sm">No sample tasks</li>
        ) : (
          data.map((entry) => (
            <li key={entry.status} className="min-w-0">
              {interactive ? (
                <button
                  type="button"
                  className="hover:bg-muted/60 flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm"
                  onClick={() => onSliceClick?.(entry.status as WorkItemStatus)}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.swatch }}
                    aria-hidden
                  />
                  <TruncatedText
                    className={cn(
                      'text-foreground min-w-0',
                      isDialog || isSplit ? 'max-w-44' : 'max-w-32'
                    )}
                  >
                    {`${entry.label}: ${entry.percent}`}
                  </TruncatedText>
                </button>
              ) : (
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.swatch }}
                    aria-hidden
                  />
                  <TruncatedText
                    className={cn(
                      'text-foreground min-w-0',
                      isDialog || isSplit ? 'max-w-44' : 'max-w-32'
                    )}
                  >
                    {`${entry.label}: ${entry.percent}`}
                  </TruncatedText>
                </div>
              )}
            </li>
          ))
        )}
        {total > 0 ? (
          <li className="text-muted-foreground pt-1 text-xs">
            {total} sample tasks
          </li>
        ) : null}
      </ul>
    </div>
  );
}
