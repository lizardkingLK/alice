import { Badge } from '@repo/ui/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { cn } from '@repo/ui/lib/utils';
import { WorkItemListRow } from '@/app/work-items/_components/work-item-list-row';
import { workItemDetailHref } from '@/app/work-items/_helpers/work-item-links';
import type {
  HomeLaunchpadCompletion,
  HomeLaunchpadWorkItem,
} from '@/app/_components/home/home-launchpad.types';

type HomeWipPanelProps = {
  readonly items: readonly HomeLaunchpadWorkItem[];
  readonly completion: HomeLaunchpadCompletion;
  readonly variant?: 'card' | 'plain';
  /** When false, omit the section title (shell already provides one). */
  readonly showTitle?: boolean;
  /** When false, render even if `items` is empty (caller shows empty copy). */
  readonly hideWhenEmpty?: boolean;
};

export function AssignedCompletionPill({
  percent,
}: Readonly<{ percent: number }>) {
  return (
    <Badge
      variant="secondary"
      className="tabular-nums"
      title={`${percent}% of assigned work items are Done`}
    >
      {percent}% completed
    </Badge>
  );
}

export function HomeWipList({
  items,
}: Readonly<{ items: readonly HomeLaunchpadWorkItem[] }>) {
  return (
    <ul className="divide-border/60 -mx-1.5 divide-y">
      {items.map((item) => {
        const href = workItemDetailHref(item.id, {
          projectKey: item.projectKey,
          workItemSlug: item.slug,
        });
        return (
          <li key={item.id}>
            <WorkItemListRow
              href={href}
              title={item.title}
              status={item.status}
              projectKey={item.projectKey}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function HomeWipPanel({
  items,
  completion,
  variant = 'card',
  showTitle = true,
  hideWhenEmpty = true,
}: Readonly<HomeWipPanelProps>) {
  if (hideWhenEmpty && items.length === 0) {
    return null;
  }

  const header = showTitle ? (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <CardTitle className="text-base">Work in progress</CardTitle>
      <AssignedCompletionPill percent={completion.percent} />
    </div>
  ) : (
    <div className="flex justify-end">
      <AssignedCompletionPill percent={completion.percent} />
    </div>
  );

  const body = items.length > 0 ? <HomeWipList items={items} /> : null;

  if (variant === 'plain') {
    return (
      <section className="space-y-3">
        {header}
        {body}
      </section>
    );
  }

  return (
    <Card size="sm" className={cn('dashboard-widget-glass shadow-none')}>
      <CardHeader className="pb-2">{header}</CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
