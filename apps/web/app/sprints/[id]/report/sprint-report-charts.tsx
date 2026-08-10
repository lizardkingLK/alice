'use client';

import * as React from 'react';
import { TrendingUp, BarChart3 } from '@repo/ui/lib/icons';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Cell,
  Pie,
  PieChart,
  type ChartConfig,
} from '@repo/ui/components/ui/chart';
import { Progress } from '@repo/ui/components/ui/progress';
import { cn } from '@repo/ui/lib/utils';
import {
  STATUS_META,
  STATUS_INDICATOR_BG,
  STATUS_ORDER,
} from '@/app/work-items/_helpers/work-item-status';

type SprintReportChartsProps = {
  completedIssues: number;
  totalIssues: number;
  completionRate: string;
  completedStoryPoints: number;
  totalPlannedStoryPoints: number;
  statusCounts: Record<string, { count: number; points: number }>;
  chartData: Array<{
    status: string;
    label: string;
    count: number;
    fill: string;
  }>;
};

export function SprintReportCharts({
  completedIssues,
  totalIssues,
  completionRate,
  completedStoryPoints,
  totalPlannedStoryPoints,
  statusCounts,
  chartData,
}: Readonly<SprintReportChartsProps>) {
  const chartConfig = React.useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    for (const status of STATUS_ORDER) {
      const meta = STATUS_META[status];
      if (meta) {
        config[status] = {
          label: meta.label,
          color: meta.color,
        };
      }
    }
    return config;
  }, []);

  return (
    <div className="progress-chart-grid grid gap-6 md:grid-cols-2">
      {/* Progress Card */}
      <Card className="border-border/60 bg-card/50 card backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="text-muted-foreground h-5 w-5" />
            <CardTitle className="text-base font-semibold">
              Sprint Progress
            </CardTitle>
          </div>
          <CardDescription>
            Aggregated completion across all work items
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Work items progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">
                Work Items
              </span>
              <span className="text-foreground font-semibold tabular-nums">
                {completedIssues} / {totalIssues}
              </span>
            </div>
            <Progress
              value={
                totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0
              }
              className="h-3"
              indicatorClassName="bg-emerald-500"
            />
            <p className="text-muted-foreground text-xs">
              {completionRate}% complete
            </p>
          </div>

          {/* Story points progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">
                Story Points
              </span>
              <span className="text-foreground font-semibold tabular-nums">
                {completedStoryPoints} / {totalPlannedStoryPoints}
              </span>
            </div>
            <Progress
              value={
                totalPlannedStoryPoints > 0
                  ? (completedStoryPoints / totalPlannedStoryPoints) * 100
                  : 0
              }
              className="h-3"
              indicatorClassName="bg-indigo-500"
            />
            <p className="text-muted-foreground text-xs">
              {totalPlannedStoryPoints > 0
                ? (
                    (completedStoryPoints / totalPlannedStoryPoints) *
                    100
                  ).toFixed(0)
                : '0'}
              % velocity delivered
            </p>
          </div>

          {/* Mini status bars list */}
          <div className="border-border/30 space-y-3 border-t pt-4">
            {STATUS_ORDER.map((status) => {
              const meta = STATUS_META[status]!;
              const data = statusCounts[status]!;
              const pct =
                totalIssues > 0
                  ? ((data.count / totalIssues) * 100).toFixed(0)
                  : '0';
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={cn('font-medium', meta.textClass)}>
                      {meta.label}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {data.count} ({pct}%)
                    </span>
                  </div>
                  <Progress
                    value={Number(pct)}
                    className="h-1.5"
                    indicatorClassName={STATUS_INDICATOR_BG[status]}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Donut Chart Card */}
      <Card className="border-border/60 bg-card/50 card backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="text-muted-foreground h-5 w-5" />
            <CardTitle className="text-base font-semibold">
              Status Distribution
            </CardTitle>
          </div>
          <CardDescription>
            Visual breakdown of work items by current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="text-muted-foreground flex h-48 items-center justify-center text-sm">
              No work items to display
            </div>
          ) : (
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square max-h-70"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent nameKey="label" hideLabel />}
                />
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={60}
                  outerRadius={100}
                  strokeWidth={3}
                  paddingAngle={2}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {STATUS_ORDER.map((status) => {
              const meta = STATUS_META[status]!;
              const data = statusCounts[status]!;
              if (data.count === 0) return null;
              return (
                <div key={status} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      'h-2.5 w-2.5 rounded-sm',
                      STATUS_INDICATOR_BG[status]
                    )}
                  />
                  <span className="text-muted-foreground text-xs font-medium">
                    {meta.label}{' '}
                    <span className="text-foreground font-semibold">
                      {data.count}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
