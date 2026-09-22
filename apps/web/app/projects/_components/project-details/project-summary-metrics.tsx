import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  ClipboardPenLine,
  Network,
  Plug,
  SlidersHorizontal,
  Timer,
  Users,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { projectDetailHref } from '@/app/projects/_helpers/project-links';
import type { ProjectDetailsTab } from '@/lib/search-params';

type MetricTone = 'primary' | 'blue' | 'amber' | 'violet' | 'emerald' | 'slate';

type SummaryMetricCardProps = {
  readonly label: string;
  readonly value: number;
  readonly caption: string;
  readonly icon: ReactNode;
  readonly tone: MetricTone;
  readonly href: string;
};

const TONE_ICON_CLASS: Record<MetricTone, string> = {
  primary: 'bg-primary/10 text-primary',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
};

function SummaryMetricCard({
  label,
  value,
  caption,
  icon,
  tone,
  href,
}: SummaryMetricCardProps) {
  return (
    <Link
      href={href}
      className="group focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <Card className="border-border/60 bg-card/50 group-hover:border-border group-hover:bg-card h-full backdrop-blur-sm transition-colors">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <span className="text-muted-foreground text-xs font-medium">
              {label}
            </span>
            <CardTitle className="text-3xl font-bold tracking-tight">
              {value}
            </CardTitle>
          </div>
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              TONE_ICON_CLASS[tone]
            )}
          >
            {icon}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-xs">{caption}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

type MetricDefinition = {
  readonly tab: ProjectDetailsTab;
  readonly label: string;
  readonly value: number;
  readonly caption: string;
  readonly tone: MetricTone;
  readonly icon: ReactNode;
  readonly managerOrAdminOnly?: boolean;
};

type ProjectSummaryMetricsProps = {
  readonly projectId: string;
  readonly memberCount: number;
  readonly teamCount: number;
  readonly workItemCount: number;
  readonly sprintCount: number;
  readonly integrationCount: number;
  readonly fieldCount: number;
  readonly isManagerOrAdmin: boolean;
};

export function ProjectSummaryMetrics({
  projectId,
  memberCount,
  teamCount,
  workItemCount,
  sprintCount,
  integrationCount,
  fieldCount,
  isManagerOrAdmin,
}: ProjectSummaryMetricsProps) {
  const metrics: readonly MetricDefinition[] = [
    {
      tab: 'members',
      label: 'Members',
      value: memberCount,
      caption: 'People on this project',
      tone: 'primary',
      icon: <Users className="h-5 w-5" />,
    },
    {
      tab: 'teams',
      label: 'Teams',
      value: teamCount,
      caption: 'Teams linked to this project',
      tone: 'blue',
      icon: <Network className="h-5 w-5" />,
    },
    {
      tab: 'work-items',
      label: 'Work Items',
      value: workItemCount,
      caption: 'Items in this project',
      tone: 'amber',
      icon: <ClipboardPenLine className="h-5 w-5" />,
    },
    {
      tab: 'sprints',
      label: 'Sprints',
      value: sprintCount,
      caption: 'Sprints in this project',
      tone: 'violet',
      icon: <Timer className="h-5 w-5" />,
      managerOrAdminOnly: true,
    },
    {
      tab: 'integrations',
      label: 'Integrations',
      value: integrationCount,
      caption: 'Connected integrations',
      tone: 'emerald',
      icon: <Plug className="h-5 w-5" />,
    },
    {
      tab: 'fields',
      label: 'Fields',
      value: fieldCount,
      caption: 'Custom dynamic fields',
      tone: 'slate',
      icon: <SlidersHorizontal className="h-5 w-5" />,
    },
  ];

  const visibleMetrics = metrics.filter(
    (metric) => !metric.managerOrAdminOnly || isManagerOrAdmin
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visibleMetrics.map((metric) => (
        <SummaryMetricCard
          key={metric.tab}
          label={metric.label}
          value={metric.value}
          caption={metric.caption}
          tone={metric.tone}
          icon={metric.icon}
          href={projectDetailHref(projectId, metric.tab)}
        />
      ))}
    </div>
  );
}
