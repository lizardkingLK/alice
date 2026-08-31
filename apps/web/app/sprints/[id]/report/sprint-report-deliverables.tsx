'use client';

import * as React from 'react';
import Image from 'next/image';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { PriorityBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-priority';
import { FileText } from '@repo/ui/lib/icons';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { cn } from '@repo/ui/lib/utils';
import {
  STATUS_META,
  STATUS_ORDER,
} from '@/app/work-items/_helpers/work-item-status';

type SprintReportDeliverablesProps = {
  totalIssues: number;
  activeFilter: string | null;
  setActiveFilter: React.Dispatch<React.SetStateAction<string | null>>;
  filteredWorkItems: DbWorkItem[];
  statusCounts: Record<string, { count: number; points: number }>;
};

export function SprintReportDeliverables({
  totalIssues,
  activeFilter,
  setActiveFilter,
  filteredWorkItems,
  statusCounts,
}: Readonly<SprintReportDeliverablesProps>) {
  return (
    <Card className="border-border/60 bg-card/50 card deliverables-card">
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
                'inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                activeFilter === null
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              All <span className="ml-0.5 tabular-nums">{totalIssues}</span>
            </button>
            {STATUS_ORDER.map((status) => {
              const meta = STATUS_META[status]!;
              const data = statusCounts[status]!;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setActiveFilter((prev) => (prev === status ? null : status))
                  }
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    activeFilter === status
                      ? `${meta.bgClass} ${meta.textClass}`
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                            statusMeta
                              ? `${statusMeta.bgClass} ${statusMeta.textClass}`
                              : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'
                          )}
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
  );
}
