'use client';

// useRef: stores mutable references without triggering re-renders.
// useState: manages component state and triggers re-renders when updated.
// useMemo: memoizes calculated values to avoid unnecessary recalculations.
import { useRef, useState, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';

import type { Sprint } from '@/app/sprints/_services/sprints.service';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import {
  Calendar,
  CheckCircle,
  Goal,
  Layers,
  Sparkles,
  Trophy,
  Download,
  FileDown,
  AlertCircle,
} from '@repo/ui/lib/icons';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
import {
  STATUS_META,
  STATUS_ORDER,
} from '@/app/work-items/_helpers/work-item-status';
import { SprintReportCharts } from './sprint-report-charts';
import { SprintReportDeliverables } from './sprint-report-deliverables';

type SprintReportViewProps = {
  sprint: Sprint;
  workItems: DbWorkItem[];
};

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
      <div className="sprint-report-stats-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* ====== Status Breakdown Tiles ====== */}
      <div className="status-breakdown-grid grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATUS_ORDER.map((status) => {
          const meta = STATUS_META[status]!;
          const data = statusCounts[status]!;
          const Icon = meta.icon;

          return (
            <Card
              key={status}
              className={cn(
                'border-border/60 bg-card/50 card cursor-pointer',
                'backdrop-blur-sm transition-all hover:scale-[1.02]',
                activeFilter === status &&
                  `ring-2 ring-offset-1 ${meta.borderClass} ring-current ${meta.textClass}`
              )}
              onClick={() =>
                setActiveFilter((prev) => (prev === status ? null : status))
              }
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    meta.bgClass,
                    meta.textClass
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs font-medium">
                    {meta.label}
                  </p>
                  <p className="text-foreground text-xl leading-tight font-bold tabular-nums">
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

      {/* ====== Sprint Progress + Donut Chart ====== */}
      <SprintReportCharts
        completedIssues={completedIssues}
        totalIssues={totalIssues}
        completionRate={completionRate}
        completedStoryPoints={completedStoryPoints}
        totalPlannedStoryPoints={totalPlannedStoryPoints}
        statusCounts={statusCounts}
        chartData={chartData}
      />

      {/* Goal & Achievements overview */}
      <div className="sprint-report-goals-grid grid gap-6 md:grid-cols-3">
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

      {/* ====== Deliverables Table ====== */}
      <SprintReportDeliverables
        totalIssues={totalIssues}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        filteredWorkItems={filteredWorkItems}
        statusCounts={statusCounts}
      />
    </div>
  );
}
