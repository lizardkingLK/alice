'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from '@repo/ui/components/ui/chart';
import {
  ACTIVITY_ITEMS,
  BURNDOWN_CONFIG,
  STAT_VALUES,
  STATUS_MIX_CONFIG,
  STATUS_MIX_DATA,
  VELOCITY_CONFIG,
  VELOCITY_DATA,
  WIDGET_CATALOG,
  type WidgetId,
} from './dashboard-mock-data';
import { DashboardWidgetShell } from './dashboard-widget-shell';
import { SIDEBAR_LAYOUT_SETTLE_MS } from '@/hooks/use-sidebar-layout-settling';
import { createClient } from '@/lib/supabase/client';
import { readBoardDefaults } from '@/app/board/_helpers/board-defaults-storage';
import { ALL_PROJECTS_ID } from '@/app/board/_helpers/workspace-defaults-shared';
import { loadSprintBurndownAction } from '@/app/dashboard/_components/actions';
import type { DashboardBurndownBootstrap } from '@/app/dashboard/_services/dashboard.reads.burndown.server';
import { SprintStatusEnum } from '@repo/types';
import type { SprintBurndownPayload } from '@repo/types';

const widgetById = Object.fromEntries(
  WIDGET_CATALOG.map((widget) => [widget.id, widget])
) as Record<WidgetId, (typeof WIDGET_CATALOG)[number]>;

type StatWidgetProps = { id: keyof typeof STAT_VALUES };

function StatWidget({ id }: Readonly<StatWidgetProps>) {
  const meta = widgetById[id];
  const stat = STAT_VALUES[id];

  return (
    <DashboardWidgetShell title={meta.title} description={meta.description}>
      <div className="flex flex-1 flex-col justify-end gap-1">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">
          {stat.value}
        </p>
        <p className="text-muted-foreground text-sm">{stat.delta}</p>
      </div>
    </DashboardWidgetShell>
  );
}

type ChartSize = {
  width: number;
  height: number;
};

type ChartViewportType = {
  config: ComponentProps<typeof ChartContainer>['config'];
  children: ComponentProps<typeof ChartContainer>['children'];
};

function ChartViewport({ config, children }: Readonly<ChartViewportType>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ChartSize | null>(null);
  const pendingSizeRef = useRef<ChartSize | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const applySize = (next: ChartSize) => {
      setSize((previous) => {
        if (previous?.width === next.width && previous.height === next.height) {
          return previous;
        }
        return next;
      });
    };

    const measure = (): ChartSize | null => {
      const { width, height } = element.getBoundingClientRect();
      const nextWidth = Math.floor(width);
      const nextHeight = Math.floor(height);

      if (nextWidth <= 0 || nextHeight <= 0) {
        return null;
      }

      return { width: nextWidth, height: nextHeight };
    };

    const scheduleSizeUpdate = () => {
      const next = measure();
      if (!next) {
        return;
      }

      pendingSizeRef.current = next;

      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }

      // Coalesce ResizeObserver spam (sidebar / grid transitions) into one paint.
      settleTimerRef.current = window.setTimeout(() => {
        settleTimerRef.current = null;
        if (pendingSizeRef.current) {
          applySize(pendingSizeRef.current);
        }
      }, SIDEBAR_LAYOUT_SETTLE_MS);
    };

    const initial = measure();
    if (initial) {
      applySize(initial);
    }

    const observer = new ResizeObserver(scheduleSizeUpdate);
    observer.observe(element);

    return () => {
      observer.disconnect();
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  return (
    <div ref={viewportRef} className="relative min-h-0 w-full flex-1">
      {size ? (
        <ChartContainer
          config={config}
          width={size.width}
          height={size.height}
          className="aspect-auto h-full w-full justify-center"
        >
          {children}
        </ChartContainer>
      ) : null}
    </div>
  );
}

function StatusMixWidget() {
  const meta = widgetById['status-mix'];

  return (
    <DashboardWidgetShell title={meta.title} description={meta.description}>
      <ChartViewport config={STATUS_MIX_CONFIG}>
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel nameKey="status" />}
          />
          <Pie
            data={[...STATUS_MIX_DATA]}
            dataKey="count"
            nameKey="status"
            innerRadius="48%"
            outerRadius="78%"
            paddingAngle={2}
            strokeWidth={2}
          >
            {STATUS_MIX_DATA.map((entry) => (
              <Cell key={entry.status} fill={entry.fill} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="status" />} />
        </PieChart>
      </ChartViewport>
    </DashboardWidgetShell>
  );
}

type BurndownPoint = SprintBurndownPayload['series'][number];

type BurndownAxisRange = {
  startDate: string;
  endDate: string;
};

const BURNDOWN_EMPTY_NO_SPRINT = 'No active sprint selected.';
const BURNDOWN_EMPTY_UNAVAILABLE =
  'Burndown is temporarily unavailable. If you are an admin, verify the burndown migration is applied and this sprint has work items.';

function defaultBurndownAxisRange(): BurndownAxisRange {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function buildEmptyBurndownAxisScaffold(
  range: BurndownAxisRange
): BurndownPoint[] {
  return [
    { date: range.startDate, remaining: null, ideal: 0 },
    { date: range.endDate, remaining: null, ideal: 0 },
  ];
}

function computeBurndownYAxisMax(
  points: BurndownPoint[],
  estimatedTotal = 0
): number {
  const peak = points.reduce((max, point) => {
    const next = Math.max(point.ideal, point.remaining ?? 0);
    return Math.max(max, next);
  }, 0);

  return Math.max(peak, estimatedTotal, 10);
}

function formatBurndownTick(isoDate: string) {
  // Force UTC parsing to avoid timezone shifts like Jul 28 vs Jul 29.
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

type BurndownSprintListItem = DashboardBurndownBootstrap['sprints'][number];

function selectBurndownSprint(
  sprints: readonly BurndownSprintListItem[],
  preference: {
    readonly projectId: string;
    readonly sprintId: string | null;
  } | null
): BurndownSprintListItem | undefined {
  const candidates =
    preference?.projectId && preference.projectId !== ALL_PROJECTS_ID
      ? sprints.filter((sprint) => sprint.project?.id === preference.projectId)
      : sprints;

  return (
    (preference?.sprintId
      ? candidates.find((sprint) => sprint.id === preference.sprintId)
      : undefined) ??
    candidates.find((sprint) => sprint.status === SprintStatusEnum.Active) ??
    candidates.find((sprint) => sprint.status === SprintStatusEnum.Planned) ??
    candidates[0]
  );
}

function applyBurndownPayload(burndown: SprintBurndownPayload | null): {
  series: BurndownPoint[];
  estimatedTotal: number;
  axisRange: BurndownAxisRange;
  emptyHint: string | null;
} {
  if (!burndown) {
    return {
      series: [],
      estimatedTotal: 0,
      axisRange: defaultBurndownAxisRange(),
      emptyHint: BURNDOWN_EMPTY_NO_SPRINT,
    };
  }

  return {
    series: burndown.series,
    estimatedTotal: burndown.estimatedTotal,
    axisRange: {
      startDate: burndown.sprint.startDate,
      endDate: burndown.sprint.endDate,
    },
    emptyHint: null,
  };
}

async function resolvePreferredBurndown(
  bootstrap: DashboardBurndownBootstrap
): Promise<{
  series: BurndownPoint[];
  estimatedTotal: number;
  axisRange: BurndownAxisRange;
  emptyHint: string | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const preference = user
    ? (readBoardDefaults(user.id)?.preference ?? null)
    : null;
  const selected = selectBurndownSprint(bootstrap.sprints, preference);

  if (!selected) {
    return {
      series: [],
      estimatedTotal: 0,
      axisRange: defaultBurndownAxisRange(),
      emptyHint: BURNDOWN_EMPTY_NO_SPRINT,
    };
  }

  if (selected.id === bootstrap.defaultSprintId && bootstrap.burndown) {
    return applyBurndownPayload(bootstrap.burndown);
  }

  try {
    const burndown = await loadSprintBurndownAction(selected.id);
    if (!burndown) {
      return {
        series: [],
        estimatedTotal: 0,
        axisRange: defaultBurndownAxisRange(),
        emptyHint: BURNDOWN_EMPTY_UNAVAILABLE,
      };
    }
    return applyBurndownPayload(burndown);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load burndown';
    const unavailable =
      message.includes('Failed to fetch work items for burndown') ||
      message.includes('Failed to fetch work logs for burndown');

    return {
      series: [],
      estimatedTotal: 0,
      axisRange: defaultBurndownAxisRange(),
      emptyHint: unavailable ? BURNDOWN_EMPTY_UNAVAILABLE : message,
    };
  }
}

type BurndownWidgetProps = {
  readonly bootstrap: DashboardBurndownBootstrap;
};

function BurndownWidget({ bootstrap }: BurndownWidgetProps) {
  const meta = widgetById['sprint-burndown'];
  const initial = bootstrap.burndown
    ? applyBurndownPayload(bootstrap.burndown)
    : {
        series: [] as BurndownPoint[],
        estimatedTotal: 0,
        axisRange: defaultBurndownAxisRange(),
        emptyHint: bootstrap.defaultSprintId
          ? BURNDOWN_EMPTY_UNAVAILABLE
          : BURNDOWN_EMPTY_NO_SPRINT,
      };

  const [emptyHint, setEmptyHint] = useState<string | null>(initial.emptyHint);
  const [series, setSeries] = useState<BurndownPoint[]>(initial.series);
  const [axisRange, setAxisRange] = useState<BurndownAxisRange>(
    initial.axisRange
  );
  const [estimatedTotal, setEstimatedTotal] = useState(initial.estimatedTotal);

  useEffect(() => {
    let cancelled = false;

    async function reconcilePreference() {
      const next = await resolvePreferredBurndown(bootstrap);
      if (cancelled) return;
      setSeries(next.series);
      setEstimatedTotal(next.estimatedTotal);
      setAxisRange(next.axisRange);
      setEmptyHint(next.emptyHint);
    }

    void reconcilePreference();

    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

  const hasData = series.length > 0;
  const chartData = hasData
    ? series
    : buildEmptyBurndownAxisScaffold(axisRange);
  const yAxisMax = computeBurndownYAxisMax(chartData, estimatedTotal);

  return (
    <DashboardWidgetShell title={meta.title} description={meta.description}>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ChartViewport config={BURNDOWN_CONFIG}>
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
                />
                <Line
                  type="monotone"
                  dataKey="remaining"
                  stroke="var(--color-remaining)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
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
    </DashboardWidgetShell>
  );
}

function VelocityWidget() {
  const meta = widgetById.velocity;

  return (
    <DashboardWidgetShell title={meta.title} description={meta.description}>
      <ChartViewport config={VELOCITY_CONFIG}>
        <BarChart
          data={[...VELOCITY_DATA]}
          margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="sprint"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis tickLine={false} axisLine={false} width={28} />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar
            dataKey="points"
            fill="var(--color-points)"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ChartViewport>
    </DashboardWidgetShell>
  );
}

function ActivityWidget() {
  const meta = widgetById['recent-activity'];

  return (
    <DashboardWidgetShell title={meta.title} description={meta.description}>
      <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {ACTIVITY_ITEMS.map((item) => (
          <li
            key={item.id}
            className="border-border/70 bg-muted/20 rounded-lg border px-3 py-2.5"
          >
            <p className="text-sm leading-snug font-medium">{item.title}</p>
            <p className="text-muted-foreground mt-1 text-xs">{item.meta}</p>
          </li>
        ))}
      </ul>
    </DashboardWidgetShell>
  );
}

type DashboardWidgetType = {
  id: WidgetId;
  burndownBootstrap: DashboardBurndownBootstrap;
};

export function DashboardWidget({
  id,
  burndownBootstrap,
}: Readonly<DashboardWidgetType>) {
  switch (id) {
    case 'open-issues':
    case 'in-progress':
    case 'completed':
    case 'team-members':
      return <StatWidget id={id} />;
    case 'status-mix':
      return <StatusMixWidget />;
    case 'sprint-burndown':
      return <BurndownWidget bootstrap={burndownBootstrap} />;
    case 'velocity':
      return <VelocityWidget />;
    case 'recent-activity':
      return <ActivityWidget />;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
