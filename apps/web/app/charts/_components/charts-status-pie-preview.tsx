'use client';

import { useMemo } from 'react';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import {
  buildChartsPieFromSample,
  DEFAULT_CHARTS_LABEL_FIELD,
  type ChartsLabelFieldId,
  type ChartsSampleWorkItem,
} from '@/app/charts/_components/charts-sample.data';
import type { ChartPieVariant } from '@/app/charts/_components/charts.types';
import {
  StatusDistributionWheel,
  type StatusDistributionSlice,
} from '@/components/status-distribution-wheel';

type ChartsStatusPiePreviewProps = {
  readonly className?: string;
  readonly size?: 'card' | 'dialog' | 'split';
  readonly workItems?: readonly ChartsSampleWorkItem[];
  /** Pie (solid) vs donut; defaults to donut. */
  readonly pieVariant?: ChartPieVariant;
  /** Labels → Columns group-by; defaults to status. */
  readonly labelField?: ChartsLabelFieldId;
  /** When set, pie slices and legend rows are clickable. */
  // eslint-disable-next-line no-unused-vars -- slice click callback
  readonly onSliceClick?: (sliceKey: string) => void;
};

export function ChartsStatusPiePreview({
  className,
  size = 'card',
  workItems,
  pieVariant = 'donut',
  labelField = DEFAULT_CHARTS_LABEL_FIELD,
  onSliceClick,
}: Readonly<ChartsStatusPiePreviewProps>) {
  const isDialog = size === 'dialog';
  const isSplit = size === 'split';
  const { data, config, total } = useMemo(
    () => buildChartsPieFromSample(workItems, labelField),
    [labelField, workItems]
  );

  const wheelData = data as StatusDistributionSlice[];
  const sliceInteractive = Boolean(onSliceClick);
  const innerRadius = pieVariant === 'pie' ? 0 : '48%';
  const isRoomy = isDialog || isSplit;

  const resolveSliceKey = (chartKey: string) =>
    data.find((entry) => entry.status === chartKey)?.key ?? chartKey;

  // Fill the flex slot; ChartViewport (square) sizes the pie to min(width, height).
  const pieSlotClass = 'h-full min-h-0 w-full max-w-full self-stretch';
  const legendHeightClass = isRoomy ? 'h-56' : 'h-40';
  const legendWidthClass = isRoomy ? 'w-44' : 'w-36';

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 items-center justify-center',
        isRoomy ? 'gap-8 px-4 py-2' : 'gap-4 px-2 py-2',
        className
      )}
    >
      <StatusDistributionWheel
        data={wheelData}
        config={config}
        className={cn('relative min-h-0 min-w-0 flex-1', pieSlotClass)}
        innerRadius={innerRadius}
        outerRadius="90%"
        onSliceClick={
          sliceInteractive
            ? (chartKey) => onSliceClick?.(resolveSliceKey(chartKey))
            : undefined
        }
      />

      <ScrollArea
        className={cn('shrink-0', legendHeightClass, legendWidthClass)}
        aria-label="Chart legend"
      >
        <ul
          className={cn(
            'flex flex-col justify-center pr-3',
            isRoomy ? 'gap-3' : 'gap-2'
          )}
        >
          {data.length === 0 ? (
            <li className="text-muted-foreground text-sm">No sample tasks</li>
          ) : (
            data.map((entry) => {
              const legendRow = (
                <>
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.swatch }}
                    aria-hidden
                  />
                  <TruncatedText className="text-foreground max-w-full min-w-0">
                    {`${entry.label}: ${entry.percent}`}
                  </TruncatedText>
                </>
              );
              return (
                <li key={entry.status} className="min-w-0">
                  {sliceInteractive ? (
                    <button
                      type="button"
                      className="hover:bg-muted/60 flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm"
                      onClick={() => onSliceClick?.(entry.key)}
                    >
                      {legendRow}
                    </button>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      {legendRow}
                    </div>
                  )}
                </li>
              );
            })
          )}
          {total > 0 ? (
            <li className="text-muted-foreground pt-1 text-xs">
              {total} sample tasks
            </li>
          ) : null}
        </ul>
      </ScrollArea>
    </div>
  );
}
