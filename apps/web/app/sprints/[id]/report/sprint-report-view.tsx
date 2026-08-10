'use client';

import { useRef, useState, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';

import Image from 'next/image';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import {
  Calendar,
  CheckCircle,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  FileText,
  Goal,
  Layers,
  Sparkles,
  Trophy,
  Download,
  FileDown,
  AlertCircle,
  FlaskConical,
  TrendingUp,
  BarChart3,
} from '@repo/ui/lib/icons';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
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

type SprintReportViewProps = {
  sprint: Sprint;
  workItems: DbWorkItem[];
};

/* ---------- Status metadata ---------- */

type StatusMeta = {
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STATUS_META: Record<string, StatusMeta> = {
  New: {
    label: 'New',
    color: 'oklch(0.63 0.18 250)',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-500/20',
    icon: Circle,
  },
  ToDo: {
    label: 'To Do',
    color: 'oklch(0.55 0.03 264)',
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-600 dark:text-slate-400',
    borderClass: 'border-slate-500/20',
    icon: CircleDot,
  },
  InProgress: {
    label: 'In Progress',
    color: 'oklch(0.75 0.15 85)',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-500/20',
    icon: Clock,
  },
  Testing: {
    label: 'Testing',
    color: 'oklch(0.62 0.19 295)',
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-600 dark:text-purple-400',
    borderClass: 'border-purple-500/20',
    icon: FlaskConical,
  },
  Done: {
    label: 'Done',
    color: 'oklch(0.65 0.17 155)',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-500/20',
    icon: CheckCircle2,
  },
};

const STATUS_INDICATOR_BG: Record<string, string> = {
  New: 'bg-blue-500',
  ToDo: 'bg-slate-500',
  InProgress: 'bg-amber-500',
  Testing: 'bg-purple-500',
  Done: 'bg-emerald-500',
};

const STATUS_ORDER = ['New', 'ToDo', 'InProgress', 'Testing', 'Done'] as const;

/* ---------- Helpers ---------- */

function formatDate(dateStr: string | null | Date): string {
  if (!dateStr) return 'No date';
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
}

/* ---------- Component ---------- */

export function SprintReportView({
  sprint,
  workItems,
}: Readonly<SprintReportViewProps>) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  /* ---- Derived metrics ---- */
  const totalIssues = workItems.length;
  const completedIssues = workItems.filter(
    (item) => item.status === 'Done'
  ).length;
  const completedStoryPoints = workItems
    .filter((item) => item.status === 'Done')
    .reduce((sum, item) => sum + (item.story_points ?? 0), 0);
  const totalPlannedStoryPoints = workItems.reduce(
    (sum, item) => sum + (item.story_points ?? 0),
    0
  );

  const completionRate =
    totalIssues > 0 ? ((completedIssues / totalIssues) * 100).toFixed(0) : '0';

  /* ---- Per-status counts ---- */
  const statusCounts = useMemo(() => {
    const counts: Record<string, { count: number; points: number }> = {};
    for (const status of STATUS_ORDER) {
      counts[status] = { count: 0, points: 0 };
    }
    for (const item of workItems) {
      const status = item.status;
      if (counts[status]) {
        counts[status].count += 1;
        counts[status].points += item.story_points ?? 0;
      }
    }
    return counts;
  }, [workItems]);

  /* ---- Chart data ---- */
  const chartConfig = useMemo<ChartConfig>(() => {
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

  const chartData = useMemo(() => {
    return STATUS_ORDER.filter((s) => statusCounts[s]!.count > 0).map(
      (status) => ({
        status,
        label: STATUS_META[status]!.label,
        count: statusCounts[status]!.count,
        fill: `var(--color-${status})`,
      })
    );
  }, [statusCounts]);

  /* ---- Filtered work items ---- */
  const filteredWorkItems = useMemo(() => {
    if (!activeFilter) return workItems;
    return workItems.filter((item) => item.status === activeFilter);
  }, [workItems, activeFilter]);

  /* ---- Export actions ---- */
  const handleDownloadMarkdown = () => {
    const formattedDateRange = `${formatDate(sprint.startDate)} – ${formatDate(sprint.endDate)}`;

    let md = `# Sprint Summary Report: ${sprint.name}\n\n`;
    md += `* **Status**: ${sprint.status}\n`;
    md += `* **Project**: ${sprint.project?.name || 'N/A'}\n`;
    md += `* **Dates**: ${formattedDateRange}\n\n`;

    md += `## Key Metrics\n\n`;
    md += `* **Completion Scope**: ${completionRate}%\n`;
    md += `* **Work Items Done**: ${completedIssues} / ${totalIssues}\n`;
    md += `* **Velocity Delivered**: ${completedStoryPoints} of ${totalPlannedStoryPoints} planned story points\n\n`;

    md += `## Status Breakdown\n\n`;
    md += `| Status | Count | Story Points |\n`;
    md += `| :--- | :---: | :---: |\n`;
    for (const status of STATUS_ORDER) {
      const meta = STATUS_META[status];
      const data = statusCounts[status];
      if (meta && data) {
        md += `| ${meta.label} | ${data.count} | ${data.points} |\n`;
      }
    }
    md += `\n`;

    md += `## Sprint Goal\n\n`;
    md += `${sprint.goal || 'No goal was defined for this sprint.'}\n\n`;

    md += `## Deliverables List\n\n`;
    if (workItems.length === 0) {
      md += `No work items were assigned to this sprint.\n`;
    } else {
      md += `| Type | Key | Title | Priority | Status | Assignee | Story Points |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- | :--- | :---: |\n`;
      workItems.forEach((item) => {
        const itemKey = item.project
          ? `${item.project.key}-${item.id.slice(0, 4).toUpperCase()}`
          : item.id.slice(0, 8).toUpperCase();
        const assigneeName = item.assignee?.name || 'Unassigned';
        const storyPoints = item.story_points ?? '–';
        md += `| ${item.type} | ${itemKey} | ${item.title} | ${item.priority} | ${item.status} | ${assigneeName} | ${storyPoints} |\n`;
      });
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${sprint.name.toLowerCase().replace(/\s+/g, '_')}_summary_report.md`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const printRef = useRef<HTMLDivElement>(null);

  // Action: Trigger Browser Print/Save PDF via react-to-print
  const handleDownloadPDF = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${sprint.name.toLowerCase().replace(/\s+/g, '_')}_summary_report`,
  });

  return (
    <div ref={printRef} className="print-container space-y-6">
      {/* Banner header */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/15 bg-linear-to-r from-indigo-500/5 via-transparent to-transparent p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {sprint.status === 'closed' ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle className="mr-1 h-3.5 w-3.5 fill-current" />
                  Closed
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 font-semibold text-blue-600 dark:text-blue-400"
                >
                  <AlertCircle className="mr-1 h-3.5 w-3.5 fill-current" />
                  Active
                </Badge>
              )}
              {sprint.project && (
                <span className="text-muted-foreground text-xs font-medium">
                  Project:{' '}
                  <span className="text-foreground font-semibold">
                    {sprint.project.name}
                  </span>
                </span>
              )}
            </div>
            <h1 className="text-foreground mt-2 text-2xl font-bold tracking-tight md:text-3xl">
              {sprint.name} Summary Report
            </h1>
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons (hidden on print) */}
          <div className="no-print flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadMarkdown}
              className="h-9 cursor-pointer gap-1.5 text-xs font-semibold"
            >
              <Download className="h-4 w-4" />
              Markdown
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              className="h-9 cursor-pointer gap-1.5 text-xs font-semibold"
            >
              <FileDown className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid (existing 3 cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/50 card backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium">
                Completed Scope
              </span>
              <CardTitle className="text-3xl font-bold tracking-tight">
                {completionRate}%
              </CardTitle>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Trophy className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              {sprint.status === 'closed'
                ? 'All planned work items successfully delivered'
                : 'Current ratio of done vs planned sprint scope'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50 card backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium">
                Work Items Done
              </span>
              <CardTitle className="text-3xl font-bold tracking-tight">
                {completedIssues} / {totalIssues}
              </CardTitle>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Layers className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              Total issues resolved during the sprint iteration
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50 card backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium">
                Velocity Delivered
              </span>
              <CardTitle className="text-3xl font-bold tracking-tight">
                {completedStoryPoints}{' '}
                <span className="text-muted-foreground text-sm font-medium">
                  / {totalPlannedStoryPoints} pts
                </span>
              </CardTitle>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              Sum of story points delivered across all completed items
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ====== NEW: Status Breakdown Tiles ====== */}
      <div className="status-breakdown-grid grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATUS_ORDER.map((status) => {
          const meta = STATUS_META[status]!;
          const data = statusCounts[status]!;
          const Icon = meta.icon;

          return (
            <Card
              key={status}
              className={cn(
                "border-border/60 bg-card/50 card cursor-pointer",
                "backdrop-blur-sm transition-all hover:scale-[1.02]",
                activeFilter === status && `ring-2 ring-offset-1 ${meta.borderClass} ring-current ${meta.textClass}`
              )}
              onClick={() =>
                setActiveFilter((prev) => (prev === status ? null : status))
              }
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.bgClass} ${meta.textClass}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs font-medium">
                    {meta.label}
                  </p>
                  <p className="text-foreground text-xl font-bold tabular-nums leading-tight">
                    {data.count}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[10px] font-medium">
                    {data.points} pts
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ====== NEW: Progress Bar + Donut Chart ====== */}
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
                value={totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0}
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
                value={totalPlannedStoryPoints > 0 ? (completedStoryPoints / totalPlannedStoryPoints) * 100 : 0}
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

            {/* Per-status mini bars */}
            <div className="border-border/40 space-y-2.5 border-t pt-4">
              <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
                By Status
              </p>
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
                      <span className={`font-medium ${meta.textClass}`}>
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
                    content={
                      <ChartTooltipContent nameKey="label" hideLabel />
                    }
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
                      className={cn("h-2.5 w-2.5 rounded-sm", STATUS_INDICATOR_BG[status])}
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

      {/* Goal & Detailed overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-border/60 bg-card/50 card md:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Goal className="h-5 w-5" />
              <CardTitle className="text-base font-semibold">
                Sprint Goal
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
              {sprint.goal || 'No goal was defined for this sprint.'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50 card md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Sprint Achievements
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-3 text-sm">
            <p>
              {sprint.status === 'closed'
                ? `During this iteration, the team focused on aligning dependencies and meeting sprint goals. All ${totalIssues} work items committed to the sprint were brought to completion.`
                : `This sprint is currently active. The team is collaborating to deliver ${totalIssues} work items. Currently, ${completedIssues} items have been completed.`}
            </p>
            <p>
              A total of{' '}
              <span className="text-foreground font-semibold">
                {completedStoryPoints} story points
              </span>{' '}
              have been delivered so far out of the{' '}
              <span className="text-foreground font-semibold">
                {totalPlannedStoryPoints} story points
              </span>{' '}
              planned.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ====== NEW: Filterable Deliverables Table ====== */}
      <Card className="border-border/60 bg-card/50 card">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FileText className="text-muted-foreground h-5 w-5" />
              <div>
                <CardTitle className="text-base font-semibold">
                  Deliverables List
                </CardTitle>
                <CardDescription>
                  {activeFilter
                    ? `Showing ${filteredWorkItems.length} ${STATUS_META[activeFilter]?.label ?? activeFilter} items`
                    : `Detailed list of all ${totalIssues} deliverables in this sprint.`}
                </CardDescription>
              </div>
            </div>

            {/* Filter tabs (hidden on print) */}
            <div className="no-print flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveFilter(null)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  activeFilter === null
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                All{' '}
                <span className="ml-0.5 tabular-nums">{totalIssues}</span>
              </button>
              {STATUS_ORDER.map((status) => {
                const meta = STATUS_META[status]!;
                const data = statusCounts[status]!;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() =>
                      setActiveFilter((prev) =>
                        prev === status ? null : status
                      )
                    }
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      activeFilter === status
                        ? `${meta.bgClass} ${meta.textClass}`
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {meta.label}{' '}
                    <span className="ml-0.5 tabular-nums">{data.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredWorkItems.length === 0 ? (
            <div className="text-muted-foreground p-6 text-center text-sm">
              {activeFilter
                ? `No work items with status "${STATUS_META[activeFilter]?.label ?? activeFilter}".`
                : 'No work items were assigned to this sprint.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-border/40 text-muted-foreground bg-muted/20 border-b px-4 text-xs font-semibold tracking-wider uppercase">
                    <th className="w-28 p-4">Type</th>
                    <th className="w-32 p-4">Key</th>
                    <th className="p-4">Title</th>
                    <th className="w-32 p-4">Priority</th>
                    <th className="w-28 p-4">Status</th>
                    <th className="w-48 p-4">Assignee</th>
                    <th className="w-24 p-4 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-border/30 divide-y">
                  {filteredWorkItems.map((item) => {
                    const statusMeta = STATUS_META[item.status];
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-500/10 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {item.type}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-xs font-semibold whitespace-nowrap">
                          {item.project
                            ? `${item.project.key}-${item.id.slice(0, 4).toUpperCase()}`
                            : item.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="text-foreground max-w-xs truncate p-4 font-medium">
                          {item.title}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <PriorityBadge priority={item.priority} />
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                              statusMeta
                                ? `${statusMeta.bgClass} ${statusMeta.textClass}`
                                : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            {statusMeta?.label ?? item.status}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {item.assignee?.profile_picture ? (
                              <Image
                                src={item.assignee.profile_picture}
                                alt={item.assignee.name || 'Assignee'}
                                width={24}
                                height={24}
                                className="rounded-full object-cover"
                              />
                            ) : (
                              <div className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold">
                                {(item.assignee?.name || 'Unassigned')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs">
                              {item.assignee?.name || 'Unassigned'}
                            </span>
                          </div>
                        </td>
                        <td className="text-foreground p-4 text-right font-semibold whitespace-nowrap">
                          {item.story_points ?? '–'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
