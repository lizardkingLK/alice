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
  BURNDOWN_DATA,
  STAT_VALUES,
  STATUS_MIX_CONFIG,
  STATUS_MIX_DATA,
  VELOCITY_CONFIG,
  VELOCITY_DATA,
  WIDGET_CATALOG,
  type WidgetId,
} from './dashboard-mock-data';
import { DashboardWidgetShell } from './dashboard-widget-shell';

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

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const { width, height } = element.getBoundingClientRect();
      const nextWidth = Math.floor(width);
      const nextHeight = Math.floor(height);

      if (nextWidth <= 0 || nextHeight <= 0) {
        return;
      }

      setSize((previous) => {
        if (previous?.width === nextWidth && previous.height === nextHeight) {
          return previous;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => {
      observer.disconnect();
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

function BurndownWidget() {
  const meta = widgetById['sprint-burndown'];

  return (
    <DashboardWidgetShell title={meta.title} description={meta.description}>
      <ChartViewport config={BURNDOWN_CONFIG}>
        <LineChart
          data={[...BURNDOWN_DATA]}
          margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis tickLine={false} axisLine={false} width={28} />
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
        </LineChart>
      </ChartViewport>
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

type DashboardWidgetType = { id: WidgetId };

export function DashboardWidget({ id }: Readonly<DashboardWidgetType>) {
  switch (id) {
    case 'open-issues':
    case 'in-progress':
    case 'completed':
    case 'team-members':
      return <StatWidget id={id} />;
    case 'status-mix':
      return <StatusMixWidget />;
    case 'sprint-burndown':
      return <BurndownWidget />;
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
