'use client';

import { useMemo, useState } from 'react';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { ChartPie, Loader2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { ChartSeriesLabelField, ChartSeriesSlice } from '@repo/types';
import { buildChartsPieFromSeries } from '@/app/charts/_helpers/charts-analytics.ui';
import type { ChartPieVariant } from '@/app/charts/_components/charts.types';
import type { ChartsStatusPieSlice } from '@/app/charts/_components/charts-sample.data';
import { ChartsEmptyState } from '@/app/charts/_components/charts-empty-state';
import {
  StatusDistributionWheel,
  type StatusDistributionSlice,
} from '@/components/status-distribution-wheel';

type ChartsStatusPiePreviewProps = {
  readonly className?: string;
  readonly size?: 'card' | 'dialog' | 'split';
  /** Live series slices from the analytics API. */
  readonly slices?: readonly ChartSeriesSlice[] | null;
  readonly labelField?: ChartSeriesLabelField;
  readonly loading?: boolean;
  readonly emptyMessage?: string;
  readonly totalLabel?: string;
  /** Pie (solid) vs donut; defaults to donut. */
  readonly pieVariant?: ChartPieVariant;
  /** Currently selected slice key (legend / pie toggle). */
  readonly selectedSliceKey?: string | null;
  /** When set, pie slices and legend rows are clickable toggles. */
  // eslint-disable-next-line no-unused-vars -- slice click callback
  readonly onSliceClick?: (sliceKey: string) => void;
  readonly showValueAs?: 'value' | 'percent';
  readonly sortSlicesBy?:
    'value_desc' | 'value_asc' | 'label_asc' | 'label_desc';
  readonly showEmptySlices?: boolean;
};

function findEntryByKey(
  data: readonly ChartsStatusPieSlice[],
  sliceKey: string | null | undefined
): ChartsStatusPieSlice | undefined {
  if (sliceKey == null) {
    return undefined;
  }
  return data.find((entry) => entry.key === sliceKey);
}

function findEntryByChartStatus(
  data: readonly ChartsStatusPieSlice[],
  chartStatus: string | null | undefined
): ChartsStatusPieSlice | undefined {
  if (!chartStatus) {
    return undefined;
  }
  return data.find((entry) => entry.status === chartStatus);
}

function legendRowButtonClass(isSelected: boolean, isHovered: boolean): string {
  if (isSelected) {
    return 'bg-primary/10 text-primary ring-primary/30 ring-1';
  }
  if (isHovered) {
    return 'bg-muted/60';
  }
  return 'hover:bg-muted/60';
}

function pieTotalCaption(
  total: number,
  totalLabel: string,
  selectedEntry: ChartsStatusPieSlice | undefined
): string {
  if (selectedEntry) {
    return `${selectedEntry.count} of ${total} ${totalLabel}`;
  }
  return `${total} ${totalLabel}`;
}

function ChartsPieLoadingState({
  className,
}: Readonly<{ className?: string }>) {
  return (
    <output
      className={cn(
        'text-muted-foreground flex min-h-0 flex-1 items-center justify-center',
        className
      )}
      aria-label="Loading chart"
    >
      <Loader2 className="size-6 animate-spin" aria-hidden />
    </output>
  );
}

function formatSliceMetric(
  entry: ChartsStatusPieSlice,
  showValueAs: 'value' | 'percent'
): string {
  if (showValueAs === 'value') {
    return String(entry.count);
  }
  return entry.percent;
}

function ChartsPieCenterLabel({
  entry,
  showValueAs,
}: Readonly<{
  entry: ChartsStatusPieSlice;
  showValueAs: 'value' | 'percent';
}>) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      aria-live="polite"
    >
      <div className="flex max-w-[42%] flex-col items-center gap-0.5 text-center">
        <TruncatedText className="text-foreground text-sm font-semibold tracking-tight">
          {entry.label}
        </TruncatedText>
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatSliceMetric(entry, showValueAs)}
        </span>
      </div>
    </div>
  );
}

function ChartsPieLegendSwatchRow({
  entry,
  showValueAs,
}: Readonly<{
  entry: ChartsStatusPieSlice;
  showValueAs: 'value' | 'percent';
}>) {
  return (
    <>
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: entry.swatch }}
        aria-hidden
      />
      <TruncatedText className="text-foreground max-w-full min-w-0">
        {`${entry.label}: ${formatSliceMetric(entry, showValueAs)}`}
      </TruncatedText>
    </>
  );
}

function ChartsPieLegendItem({
  entry,
  interactive,
  isSelected,
  isHovered,
  showValueAs,
  onHover,
  onSelect,
}: Readonly<{
  entry: ChartsStatusPieSlice;
  interactive: boolean;
  isSelected: boolean;
  isHovered: boolean;
  showValueAs: 'value' | 'percent';
  onHover: () => void;
  onSelect: () => void;
}>) {
  const row = (
    <ChartsPieLegendSwatchRow entry={entry} showValueAs={showValueAs} />
  );

  if (!interactive) {
    return (
      <li className="min-w-0">
        <div
          className="flex min-w-0 items-center gap-2 text-sm"
          onMouseEnter={onHover}
        >
          {row}
        </div>
      </li>
    );
  }

  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-pressed={isSelected}
        title={
          isSelected
            ? `Clear ${entry.label} filter`
            : `Filter by ${entry.label}`
        }
        className={cn(
          'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors',
          legendRowButtonClass(isSelected, isHovered)
        )}
        onMouseEnter={onHover}
        onClick={onSelect}
      >
        {row}
      </button>
    </li>
  );
}

function ChartsPieLegend({
  data,
  isRoomy,
  legendHeightClass,
  legendWidthClass,
  selectedSliceKey,
  hoveredChartStatus,
  total,
  totalLabel,
  selectedEntry,
  interactive,
  showValueAs,
  onHoverStatus,
  onSelectKey,
}: Readonly<{
  data: readonly ChartsStatusPieSlice[];
  isRoomy: boolean;
  legendHeightClass: string;
  legendWidthClass: string;
  selectedSliceKey: string | null;
  hoveredChartStatus: string | null;
  total: number;
  totalLabel: string;
  selectedEntry: ChartsStatusPieSlice | undefined;
  interactive: boolean;
  showValueAs: 'value' | 'percent';
  // eslint-disable-next-line no-unused-vars -- hover callback
  onHoverStatus: (status: string | null) => void;
  // eslint-disable-next-line no-unused-vars -- select callback
  onSelectKey: (key: string) => void;
}>) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col',
        legendHeightClass,
        legendWidthClass
      )}
    >
      <ScrollArea className="min-h-0 flex-1" aria-label="Chart legend">
        <ul
          className={cn(
            // Left padding so active ring / background is not clipped by ScrollArea.
            'flex flex-col justify-center py-0.5 pr-3 pl-1.5',
            isRoomy ? 'gap-3' : 'gap-2'
          )}
          onMouseLeave={() => onHoverStatus(null)}
        >
          {data.map((entry) => (
            <ChartsPieLegendItem
              key={`${entry.key || 'null'}-${entry.status}`}
              entry={entry}
              interactive={interactive}
              isSelected={selectedSliceKey === entry.key}
              isHovered={hoveredChartStatus === entry.status}
              showValueAs={showValueAs}
              onHover={() => onHoverStatus(entry.status)}
              onSelect={() => onSelectKey(entry.key)}
            />
          ))}
        </ul>
      </ScrollArea>
      {total > 0 ? (
        <p className="text-muted-foreground shrink-0 px-1.5 pt-2 text-xs tabular-nums">
          {pieTotalCaption(total, totalLabel, selectedEntry)}
        </p>
      ) : null}
    </div>
  );
}

function ChartsPieWheelPane({
  wheelData,
  config,
  innerRadius,
  activeChartStatus,
  isDonut,
  sliceInteractive,
  focusEntry,
  showValueAs,
  onHoverStatus,
  onSliceChartKey,
}: Readonly<{
  wheelData: StatusDistributionSlice[];
  config: ReturnType<typeof buildChartsPieFromSeries>['config'];
  innerRadius: number | `${number}%`;
  activeChartStatus: string | null;
  isDonut: boolean;
  sliceInteractive: boolean;
  focusEntry: ChartsStatusPieSlice | null;
  showValueAs: 'value' | 'percent';
  // eslint-disable-next-line no-unused-vars -- hover callback
  onHoverStatus: (status: string | null) => void;
  // eslint-disable-next-line no-unused-vars -- click callback
  onSliceChartKey: (chartKey: string) => void;
}>) {
  return (
    <div className="relative h-full min-h-0 w-full max-w-full min-w-0 flex-1 self-stretch">
      <StatusDistributionWheel
        data={wheelData}
        config={config}
        className="h-full min-h-0 w-full"
        innerRadius={innerRadius}
        outerRadius="90%"
        activeStatus={activeChartStatus}
        /* Donut uses a center label; Recharts tooltip sits in the hole and overlaps it. */
        showTooltip={!isDonut}
        onSliceHover={sliceInteractive || isDonut ? onHoverStatus : undefined}
        onSliceClick={sliceInteractive ? onSliceChartKey : undefined}
      />
      {isDonut && focusEntry ? (
        <ChartsPieCenterLabel entry={focusEntry} showValueAs={showValueAs} />
      ) : null}
    </div>
  );
}

export function ChartsStatusPiePreview({
  className,
  size = 'card',
  slices = null,
  labelField = 'status',
  loading = false,
  emptyMessage = 'No work items match',
  totalLabel = 'work items',
  pieVariant = 'donut',
  selectedSliceKey = null,
  onSliceClick,
  showValueAs = 'percent',
  sortSlicesBy = 'value_desc',
  showEmptySlices = false,
}: Readonly<ChartsStatusPiePreviewProps>) {
  const isRoomy = size === 'dialog' || size === 'split';
  const { data, config, total } = useMemo(
    () =>
      buildChartsPieFromSeries(slices ?? [], labelField, {
        showEmptySlices,
        sortSlicesBy,
      }),
    [labelField, showEmptySlices, slices, sortSlicesBy]
  );

  const [hoveredChartStatus, setHoveredChartStatus] = useState<string | null>(
    null
  );

  const sliceInteractive = Boolean(onSliceClick);
  const isDonut = pieVariant !== 'pie';
  const selectedEntry = findEntryByKey(data, selectedSliceKey);
  const hoveredEntry = findEntryByChartStatus(data, hoveredChartStatus);
  const focusEntry = hoveredEntry ?? selectedEntry ?? null;

  if (loading) {
    return <ChartsPieLoadingState className={className} />;
  }

  if (data.length === 0) {
    return (
      <ChartsEmptyState
        message={emptyMessage}
        icon={ChartPie}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 items-center justify-center',
        isRoomy ? 'gap-8 px-4 py-2' : 'gap-4 px-2 py-2',
        className
      )}
    >
      <ChartsPieWheelPane
        wheelData={data as StatusDistributionSlice[]}
        config={config}
        innerRadius={isDonut ? '48%' : 0}
        activeChartStatus={focusEntry?.status ?? null}
        isDonut={isDonut}
        sliceInteractive={sliceInteractive}
        focusEntry={focusEntry}
        showValueAs={showValueAs}
        onHoverStatus={setHoveredChartStatus}
        onSliceChartKey={(chartKey) => {
          const sliceKey =
            data.find((entry) => entry.status === chartKey)?.key ?? chartKey;
          onSliceClick?.(sliceKey);
        }}
      />
      <ChartsPieLegend
        data={data}
        isRoomy={isRoomy}
        legendHeightClass={isRoomy ? 'h-56' : 'h-40'}
        legendWidthClass={isRoomy ? 'w-44' : 'w-36'}
        selectedSliceKey={selectedSliceKey}
        hoveredChartStatus={hoveredChartStatus}
        total={total}
        totalLabel={totalLabel}
        selectedEntry={selectedEntry}
        showValueAs={showValueAs}
        interactive={sliceInteractive}
        onHoverStatus={setHoveredChartStatus}
        onSelectKey={(key) => onSliceClick?.(key)}
      />
    </div>
  );
}
