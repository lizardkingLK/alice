'use client';

import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';

import Image from 'next/image';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import {
  Calendar,
  CheckCircle,
  FileText,
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
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';

type SprintReportViewProps = {
  sprint: Sprint;
  workItems: DbWorkItem[];
};

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

export function SprintReportView({
  sprint,
  workItems,
}: Readonly<SprintReportViewProps>) {
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

  // Action: Download Markdown Report
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
    pageStyle: String.raw`
      @page {
        size: portrait !important;
        margin: 10mm !important;
      }
      @media print {
        /* Force browser to print colors and background graphics */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Hide scrollbars during print */
        * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        *::-webkit-scrollbar {
          display: none !important;
        }

        /* Prevent content truncation inside scroll containers */
        .overflow-x-auto,
        .overflow-y-auto {
          overflow: visible !important;
          height: auto !important;
          max-height: none !important;
        }

        /* Hide sidebar layout, header panels, notifications, and action buttons */
        aside,
        header,
        [data-sidebar="sidebar"],
        .no-print,
        .print-hide,
        button,
        a {
          display: none !important;
        }

        /* Reset page body background for physical print layout */
        body {
          background: white !important;
          color: #09090b !important;
        }

        main,
        .print-container {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          color: #09090b !important;
          box-shadow: none !important;
          border: none !important;
        }

        /* Ensure metrics grid prints as 3 columns */
        .grid {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 16px !important;
        }

        /* Split goal and achievements block into 2 columns for print */
        .md\:grid-cols-3 {
          display: grid !important;
          grid-template-columns: 1fr 2fr !important;
          gap: 24px !important;
        }

        /* Force ink-friendly colors on text for physical paper (even from dark mode) */
        .print-container h1,
        .print-container h2,
        .print-container h3,
        .print-container h4,
        .print-container p,
        .print-container span,
        .print-container td,
        .print-container th {
          color: #09090b !important;
        }

        .print-container .text-muted-foreground {
          color: #71717a !important;
        }

        /* Ink-friendly card printing rules */
        .print-container .card {
          border: 1px solid #e4e4e7 !important;
          background-color: #fcfcfc !important;
          color: #09090b !important;
          box-shadow: none !important;
        }

        /* Shipped items table layout prints beautifully */
        .print-container table {
          border-collapse: collapse !important;
          width: 100% !important;
          table-layout: auto !important;
          border-color: #e4e4e7 !important;
        }

        .print-container th {
          background-color: #f4f4f5 !important;
          color: #27272a !important;
          border-bottom: 2px solid #e4e4e7 !important;
        }

        /* Prevent title/assignee text from truncating inside printed cells */
        .print-container td {
          max-width: none !important;
          white-space: normal !important;
          overflow: visible !important;
          text-overflow: clip !important;
        }

        .print-container tr {
          border-bottom: 1px solid #e4e4e7 !important;
          page-break-inside: avoid;
        }

        thead {
          display: table-header-group;
        }
      }
    `,
  });

  return (
    <div ref={printRef} className="print-container space-y-6">
      {/* CSS print overrides wrapper */}

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
                  closed
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 font-semibold text-blue-600 dark:text-blue-400"
                >
                  <AlertCircle className="mr-1 h-3.5 w-3.5 fill-current" />
                  active
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

      {/* Stats Grid */}
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

      {/* Work items list */}
      <Card className="border-border/60 bg-card/50 card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="text-muted-foreground h-5 w-5" />
            <div>
              <CardTitle className="text-base font-semibold">
                Deliverables List
              </CardTitle>
              <CardDescription>
                Detailed list of deliverables in this sprint.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {workItems.length === 0 ? (
            <div className="text-muted-foreground p-6 text-center text-sm">
              No work items were assigned to this sprint.
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
                  {workItems.map((item) => (
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
                            item.status === 'Done'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {item.status}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
