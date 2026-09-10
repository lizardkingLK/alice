'use client';

import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  FileText,
  Goal,
  Layers,
  Sparkles,
  TrendingUp,
  Trophy,
} from '@repo/ui/lib/icons';
import { Badge } from '@repo/ui/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  STATUS_META,
  STATUS_ORDER,
} from '@/app/work-items/_helpers/work-item-status';

type SprintReportPlaceholderProps = {
  readonly sprint: Sprint;
};

function formatDate(dateStr: string | null | Date): string {
  if (!dateStr) return 'No date';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Full report chrome with inaccessible placeholders — used while a sprint is
 * still `planned` (metrics unlock once the sprint is active or completed).
 */
export function SprintReportPlaceholder({
  sprint,
}: Readonly<SprintReportPlaceholderProps>) {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-linear-to-r from-amber-500/5 via-transparent to-transparent p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 font-semibold text-amber-700 dark:text-amber-400"
              >
                <AlertCircle className="mr-1 h-3.5 w-3.5" />
                Planned
              </Badge>
              {sprint.project ? (
                <span className="text-muted-foreground min-w-0 text-xs font-medium">
                  Project:{' '}
                  <TruncatedText
                    as="span"
                    className="text-foreground inline-block max-w-48 align-bottom font-semibold sm:max-w-64"
                  >
                    {sprint.project.name}
                  </TruncatedText>
                </span>
              ) : null}
            </div>
            <h1 className="text-foreground mt-2 text-2xl font-bold tracking-tight md:text-3xl">
              <TruncatedText as="span" className="block max-w-full md:max-w-3xl">
                {`${sprint.name} Summary Report`}
              </TruncatedText>
            </h1>
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>
                  {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                </span>
              </div>
            </div>
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
              Report charts and delivery metrics unlock when this sprint becomes
              active or is completed. The layout below shows what will appear
              once the sprint is underway.
            </p>
          </div>
        </div>
      </div>

      <div className="sprint-report-stats-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            { label: 'Completed Scope', icon: Trophy, tone: 'bg-emerald-500/10 text-emerald-600' },
            { label: 'Work Items Done', icon: Layers, tone: 'bg-indigo-500/10 text-indigo-600' },
            { label: 'Velocity Delivered', icon: Sparkles, tone: 'bg-purple-500/10 text-purple-600' },
          ] as const
        ).map(({ label, icon: Icon, tone }) => (
          <Card
            key={label}
            className="border-border/60 bg-card/50 card backdrop-blur-sm"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-2">
                <span className="text-muted-foreground text-xs font-medium">
                  {label}
                </span>
                <Skeleton className="h-8 w-20" />
              </div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg opacity-50 ${tone}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-full max-w-[14rem]" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="status-breakdown-grid grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATUS_ORDER.map((status) => {
          const meta = STATUS_META[status]!;
          const Icon = meta.icon;
          return (
            <Card
              key={status}
              className="border-border/60 bg-card/40 card pointer-events-none opacity-70"
              aria-disabled="true"
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg opacity-60 ${meta.bgClass} ${meta.textClass}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-muted-foreground text-xs font-medium">
                    {meta.label}
                  </p>
                  <Skeleton className="h-6 w-10" />
                  <Skeleton className="h-2.5 w-14" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="progress-chart-grid grid gap-6 md:grid-cols-2">
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
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">
                  Work Items
                </span>
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">
                  Story Points
                </span>
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="border-border/30 space-y-3 border-t pt-4">
              {STATUS_ORDER.map((status) => (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">
                      {STATUS_META[status]!.label}
                    </span>
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-1.5 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
            <div className="flex h-48 flex-col items-center justify-center gap-3">
              <Skeleton className="size-36 rounded-full" />
              <p className="text-muted-foreground text-center text-sm">
                Chart unavailable until the sprint is active
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {STATUS_ORDER.map((status) => (
                <div key={status} className="flex items-center gap-1.5">
                  <Skeleton className="size-2.5 rounded-sm" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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
          <CardContent>
            {sprint.goal ? (
              <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {sprint.goal}
              </p>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50 card md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Sprint Achievements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-[92%]" />
            <Skeleton className="h-3 w-4/5" />
            <p className="text-muted-foreground pt-1 text-sm">
              Achievements summary will appear after the sprint starts.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/50 card deliverables-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="text-muted-foreground h-5 w-5" />
            <div>
              <CardTitle className="text-base font-semibold">
                Deliverables
              </CardTitle>
              <CardDescription>
                Work items committed to this sprint
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={`deliverable-placeholder-${index}`}
              className="border-border/40 flex items-center gap-3 rounded-lg border p-3"
            >
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
            </div>
          ))}
          <p className="text-muted-foreground pt-1 text-center text-sm">
            Deliverables list unlocks when the sprint is active
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
