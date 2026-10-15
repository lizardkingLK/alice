'use client';

import { useMemo, useState } from 'react';
import type {
  ChartHierarchyRing,
  ChartHierarchyRingLevel,
  ChartHierarchySlice,
} from '@repo/types';
import {
  Cell,
  ChartTooltip,
  ChartTooltipContent,
  Pie,
  PieChart,
  type ChartConfig,
} from '@repo/ui/components/ui/chart';
import { cn } from '@repo/ui/lib/utils';
import { ChartViewport } from '@/components/chart-viewport';
import type { ChartsShowValueAs } from '@/app/charts/_components/charts.types';
import {
  CHARTS_DEFAULT_TOKEN_COLORS,
  chartsSliceColorCssVar,
  isChartsSliceColorToken,
  type ChartsSliceColorToken,
} from '@/app/charts/_helpers/charts-slice-colors';
import {
  encodeHierarchyFocus,
  type ChartsHierarchyFocus,
} from '@/app/charts/_helpers/charts-hierarchy-focus';
import {
  shouldDigHierarchySlice,
  type ChartsHierarchyDigStep,
} from '@/app/charts/_helpers/charts-nested-donut-widget';
import { SIDEBAR_LAYOUT_SETTLE_MS } from '@/hooks/use-sidebar-layout-settling';
import { Button } from '@repo/ui/components/ui/button';
import { ChevronLeft } from '@repo/ui/lib/icons';

type NestedSliceView = ChartHierarchySlice & {
  readonly fill: string;
  readonly ring: ChartHierarchyRingLevel;
};

/** Inner / mid / outer radii for up to 3 hierarchy rings. */
const RING_GEOMETRY: readonly {
  readonly innerRadius: string;
  readonly outerRadius: string;
  readonly paddingAngle: number;
}[] = [
  { innerRadius: '18%', outerRadius: '36%', paddingAngle: 2 },
  { innerRadius: '40%', outerRadius: '56%', paddingAngle: 1.5 },
  { innerRadius: '60%', outerRadius: '78%', paddingAngle: 1 },
];

function assignFills(
  slices: readonly ChartHierarchySlice[],
  ring: ChartHierarchyRingLevel,
  sliceColors?: Readonly<Record<string, ChartsSliceColorToken>>,
  colorOffset = 0
): NestedSliceView[] {
  return slices.map((slice, index) => {
    const override = sliceColors?.[slice.key];
    const fill =
      override && isChartsSliceColorToken(override)
        ? chartsSliceColorCssVar(override)
        : (CHARTS_DEFAULT_TOKEN_COLORS[
            (index + colorOffset) % CHARTS_DEFAULT_TOKEN_COLORS.length
          ] as string);
    return {
      ...slice,
      ring,
      fill,
    };
  });
}

function formatValue(
  value: number,
  total: number,
  showValueAs: ChartsShowValueAs
): string {
  if (showValueAs === 'percent') {
    if (total <= 0) {
      return '0%';
    }
    return `${Math.round((value / total) * 100)}%`;
  }
  return String(value);
}

function focusKeyForSlice(slice: NestedSliceView): string {
  const focus: ChartsHierarchyFocus =
    slice.ring === 0
      ? { ring: 0, sliceKey: slice.key }
      : {
          ring: slice.ring,
          sliceKey: slice.key,
          ...(slice.parentKey ? { parentKey: slice.parentKey } : {}),
        };
  return encodeHierarchyFocus(focus);
}

function NestedDonutRingPie({
  slices,
  innerRadius,
  outerRadius,
  paddingAngle,
  interactive,
  activeKey,
  onSliceClick,
  onSliceHover,
}: Readonly<{
  slices: readonly NestedSliceView[];
  innerRadius: string;
  outerRadius: string;
  paddingAngle: number;
  interactive: boolean;
  activeKey: string | null;
  // eslint-disable-next-line no-unused-vars -- slice click
  onSliceClick?: (slice: NestedSliceView) => void;
  // eslint-disable-next-line no-unused-vars -- slice hover
  onSliceHover: (focusKey: string) => void;
}>) {
  if (slices.length === 0) {
    return null;
  }
  return (
    <Pie
      data={[...slices]}
      dataKey="value"
      nameKey="label"
      innerRadius={innerRadius}
      outerRadius={outerRadius}
      strokeWidth={2}
      paddingAngle={paddingAngle}
      isAnimationActive
      className={interactive ? 'cursor-pointer outline-none' : undefined}
      onClick={(_data, index) => {
        const entry = slices[index];
        if (entry && onSliceClick) {
          onSliceClick(entry);
        }
      }}
    >
      {slices.map((entry) => {
        const focusKey = focusKeyForSlice(entry);
        const isActive = activeKey == null || activeKey === focusKey;
        return (
          <Cell
            key={`${entry.ring}-${entry.key}`}
            fill={entry.fill}
            fillOpacity={isActive ? 1 : 0.35}
            onMouseEnter={() => {
              onSliceHover(focusKey);
            }}
          />
        );
      })}
    </Pie>
  );
}

type ChartsNestedDonutPreviewProps = {
  readonly rings: readonly ChartHierarchyRing[] | null;
  readonly loading?: boolean;
  readonly emptyMessage?: string;
  readonly showValueAs?: ChartsShowValueAs;
  readonly sliceColors?: Readonly<Record<string, ChartsSliceColorToken>>;
  readonly selectedFocusKey?: string | null;
  /** Dig breadcrumb; empty = top-level scope roots. */
  readonly digPath?: readonly ChartsHierarchyDigStep[];
  onDigPathChange?: (
    // eslint-disable-next-line no-unused-vars -- dig path change
    next: readonly ChartsHierarchyDigStep[]
  ) => void;
  /**
   * When true (Table/Split), every click focuses work-item drilldown even if
   * the slice has children. When false, diggable slices zoom instead.
   */
  readonly preferDrilldown?: boolean;
  // eslint-disable-next-line no-unused-vars -- leaf / table drilldown
  readonly onDrilldownFocus?: (focusKey: string) => void;
  readonly className?: string;
  readonly size?: 'card' | 'dialog';
};

export function ChartsNestedDonutPreview({
  rings,
  loading = false,
  emptyMessage = 'No work items in the selected scope',
  showValueAs = 'percent',
  sliceColors,
  selectedFocusKey = null,
  digPath = [],
  onDigPathChange,
  preferDrilldown = false,
  onDrilldownFocus,
  className,
  size = 'card',
}: Readonly<ChartsNestedDonutPreviewProps>) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const ringViews = useMemo(() => {
    return RING_GEOMETRY.map((geometry, level) => {
      const raw =
        rings?.find((ring) => ring.level === level)?.slices ?? [];
      return {
        level: level as ChartHierarchyRingLevel,
        geometry,
        slices: assignFills(
          raw,
          level as ChartHierarchyRingLevel,
          sliceColors,
          level * 2
        ),
      };
    });
  }, [rings, sliceColors]);

  const allSlices = ringViews.flatMap((ring) => ring.slices);
  const rootTotal = ringViews[0]?.slices.reduce(
    (sum, slice) => sum + slice.value,
    0
  ) ?? 0;
  const hasData = allSlices.length > 0;

  const config = useMemo(() => {
    const next: ChartConfig = { value: { label: 'Value' } };
    for (const slice of allSlices) {
      next[slice.key] = { label: slice.label, color: slice.fill };
    }
    return next;
  }, [allSlices]);

  const activeKey = hoveredKey ?? selectedFocusKey;
  const canInteract = Boolean(onDrilldownFocus || onDigPathChange);
  const interactive = canInteract;

  const handleClick = (slice: NestedSliceView) => {
    if (
      shouldDigHierarchySlice({
        preferDrilldown,
        hasChildren: slice.hasChildren,
        digEnabled: onDigPathChange != null,
      })
    ) {
      onDigPathChange?.([
        ...digPath,
        { id: slice.key, label: slice.label },
      ]);
      return;
    }
    onDrilldownFocus?.(focusKeyForSlice(slice));
  };

  const digChrome =
    digPath.length > 0 || onDigPathChange ? (
      <div className="flex min-w-0 items-center gap-1 px-1 text-xs">
        {digPath.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 shrink-0 cursor-pointer"
            aria-label="Back to previous hierarchy level"
            title="Back"
            onClick={() => {
              onDigPathChange?.(digPath.slice(0, -1));
            }}
          >
            <ChevronLeft className="size-4" />
          </Button>
        ) : null}
        <nav
          aria-label="Hierarchy dig path"
          className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-1"
        >
          <button
            type="button"
            className={cn(
              'hover:text-foreground max-w-28 truncate cursor-pointer rounded-sm px-1 py-0.5',
              digPath.length === 0 && 'text-foreground font-medium'
            )}
            onClick={() => {
              onDigPathChange?.([]);
            }}
          >
            Scope
          </button>
          {digPath.map((step, index) => (
            <span key={step.id} className="flex min-w-0 items-center gap-1">
              <span aria-hidden>/</span>
              <button
                type="button"
                className={cn(
                  'hover:text-foreground max-w-28 truncate cursor-pointer rounded-sm px-1 py-0.5',
                  index === digPath.length - 1 && 'text-foreground font-medium'
                )}
                title={step.label}
                onClick={() => {
                  onDigPathChange?.(digPath.slice(0, index + 1));
                }}
              >
                {step.label}
              </button>
            </span>
          ))}
        </nav>
      </div>
    ) : null;

  if (loading) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex flex-1 flex-col gap-2',
          className
        )}
      >
        {digChrome}
        <div className="flex flex-1 items-center justify-center text-sm">
          Loading hierarchy…
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex flex-1 flex-col gap-2',
          className
        )}
      >
        {digChrome}
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col gap-2',
        size === 'dialog' && 'gap-3',
        className
      )}
    >
      {digChrome}
      <ChartViewport
        square
        config={config}
        settleMs={SIDEBAR_LAYOUT_SETTLE_MS}
        className="relative min-h-0 min-w-0 flex-1"
      >
        <PieChart
          onMouseLeave={() => {
            setHoveredKey(null);
          }}
        >
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel nameKey="label" />}
          />
          {ringViews.map((ring) => (
            <NestedDonutRingPie
              key={`ring-${ring.level}`}
              slices={ring.slices}
              innerRadius={ring.geometry.innerRadius}
              outerRadius={ring.geometry.outerRadius}
              paddingAngle={ring.geometry.paddingAngle}
              interactive={interactive}
              activeKey={activeKey}
              onSliceClick={canInteract ? handleClick : undefined}
              onSliceHover={setHoveredKey}
            />
          ))}
        </PieChart>
      </ChartViewport>
      <ul className="text-muted-foreground flex max-h-28 flex-wrap justify-center gap-x-3 gap-y-1 overflow-y-auto px-2 text-xs">
        {allSlices.map((slice) => {
          const ringTotal =
            ringViews[slice.ring]?.slices.reduce(
              (sum, item) => sum + item.value,
              0
            ) ?? rootTotal;
          return (
            <li
              key={`legend-${slice.ring}-${slice.key}`}
              className="flex items-center gap-1.5"
            >
              <span
                className="size-2 shrink-0 rounded-sm"
                style={{ background: slice.fill }}
                aria-hidden
              />
              <span
                className="text-foreground max-w-28 truncate"
                title={slice.label}
              >
                {slice.label}
              </span>
              <span>
                {formatValue(slice.value, ringTotal || rootTotal, showValueAs)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
