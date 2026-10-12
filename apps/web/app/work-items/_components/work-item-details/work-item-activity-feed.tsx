'use client';

import { formatRelativeTime } from '@/app/_shared/utility';
import { UserAvatar } from '@/components/user-avatar';
import type { WorkItemActivity } from '@repo/types';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTime,
  TimelineTitle,
} from '@repo/ui/components/ui/timeline';
import { History } from '@repo/ui/lib/icons';
import {
  activityActorName,
  describeActivity,
  sortActivitiesNewestFirst,
  type ActivityValueLookups,
} from '@/app/work-items/_helpers/work-item-activity-format';
import type { WorkItemActivityLayout } from '@/app/work-items/_helpers/work-item-activity-layout-preference';

type WorkItemActivityFeedProps = {
  activities: WorkItemActivity[];
  lookups?: ActivityValueLookups;
  layout?: WorkItemActivityLayout;
};

type ActivityLayoutProps = {
  readonly activities: WorkItemActivity[];
  readonly lookups: ActivityValueLookups;
};

function ActivityActorAvatar({
  activity,
  className,
}: Readonly<{
  activity: WorkItemActivity;
  className?: string;
}>) {
  return (
    <UserAvatar
      name={activityActorName(activity)}
      imageUrl={activity.actor?.profile_picture}
      className={className}
    />
  );
}

function ActivityEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 pt-12 pb-14 text-center">
        <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
          <History className="text-muted-foreground size-6" />
        </div>
        <h3 className="text-foreground text-base font-semibold">
          No activity yet
        </h3>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          Field changes and transitions will show up here.
        </p>
      </CardContent>
    </Card>
  );
}

function CardsLayout({
  activities,
  lookups,
}: Readonly<ActivityLayoutProps>) {
  return (
    <ul className="space-y-3">
      {activities.map((activity) => (
        <li
          key={activity.id}
          className="flex items-start gap-3 rounded-lg border px-3 py-3"
        >
          <ActivityActorAvatar activity={activity} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm leading-snug">
              {describeActivity(activity, lookups)}
            </p>
            <p
              className="text-muted-foreground text-xs"
              title={activity.created_at}
            >
              {formatRelativeTime(activity.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TimelineLayout({
  activities,
  lookups,
}: Readonly<ActivityLayoutProps>) {
  return (
    <Timeline>
      {activities.map((activity) => (
        <TimelineItem key={activity.id}>
          <TimelineSeparator>
            <TimelineIndicator className="overflow-hidden p-0">
              <ActivityActorAvatar activity={activity} className="size-8" />
            </TimelineIndicator>
            <TimelineConnector />
          </TimelineSeparator>
          <TimelineContent>
            <TimelineTitle>{describeActivity(activity, lookups)}</TimelineTitle>
            <TimelineTime
              dateTime={activity.created_at}
              title={activity.created_at}
            >
              {formatRelativeTime(activity.created_at)}
            </TimelineTime>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
}

function TableLayout({
  activities,
  lookups,
}: Readonly<ActivityLayoutProps>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[8.5rem]">When</TableHead>
          <TableHead className="w-[10rem]">Actor</TableHead>
          <TableHead>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activities.map((activity) => (
          <TableRow key={activity.id}>
            <TableCell
              className="text-muted-foreground whitespace-nowrap"
              title={activity.created_at}
            >
              {formatRelativeTime(activity.created_at)}
            </TableCell>
            <TableCell>
              <div className="flex min-w-0 items-center gap-2">
                <ActivityActorAvatar activity={activity} className="size-6" />
                <span className="truncate font-medium">
                  {activityActorName(activity)}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-sm">
              {describeActivity(activity, lookups)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function WorkItemActivityFeed({
  activities,
  lookups = {},
  layout = 'cards',
}: Readonly<WorkItemActivityFeedProps>) {
  if (activities.length === 0) {
    return <ActivityEmptyState />;
  }

  const sorted = sortActivitiesNewestFirst(activities);
  const layoutProps: ActivityLayoutProps = {
    activities: sorted,
    lookups,
  };

  if (layout === 'timeline') {
    return <TimelineLayout {...layoutProps} />;
  }

  if (layout === 'table') {
    return <TableLayout {...layoutProps} />;
  }

  return <CardsLayout {...layoutProps} />;
}
