import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { ClipboardPenLine, Network, Users } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type MetricTone = 'primary' | 'blue' | 'amber';

type SummaryMetricCardProps = {
  readonly label: string;
  readonly value: number;
  readonly caption: string;
  readonly icon: ReactNode;
  readonly tone: MetricTone;
};

const TONE_ICON_CLASS: Record<MetricTone, string> = {
  primary: 'bg-primary/10 text-primary',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

function SummaryMetricCard({
  label,
  value,
  caption,
  icon,
  tone,
}: SummaryMetricCardProps) {
  return (
    <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
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
  );
}

type ProjectSummaryMetricsProps = {
  readonly memberCount: number;
  readonly teamCount: number;
  readonly workItemCount: number;
};

export function ProjectSummaryMetrics({
  memberCount,
  teamCount,
  workItemCount,
}: ProjectSummaryMetricsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SummaryMetricCard
        label="Members"
        value={memberCount}
        caption="People on this project"
        tone="primary"
        icon={<Users className="h-5 w-5" />}
      />
      <SummaryMetricCard
        label="Teams"
        value={teamCount}
        caption="Teams linked to this project"
        tone="blue"
        icon={<Network className="h-5 w-5" />}
      />
      <SummaryMetricCard
        label="Work Items"
        value={workItemCount}
        caption="Items in this project"
        tone="amber"
        icon={<ClipboardPenLine className="h-5 w-5" />}
      />
    </div>
  );
}
