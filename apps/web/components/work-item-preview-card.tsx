'use client';

import { Card, CardContent } from '@repo/ui/components/ui/card';
import { Separator } from '@repo/ui/components/ui/separator';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { cn } from '@repo/ui/lib/utils';
import { PriorityBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-priority';
import { WorkItemTypeBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-type';
import type { Tables } from '@repo/types';
import { UserAvatar } from '@/components/user-avatar';

export type WorkItemPreviewCardProps = {
  readonly title: string;
  readonly type: Tables<'work_items'>['type'];
  readonly priority?: Tables<'work_items'>['priority'] | null;
  readonly descriptionPlain?: string | null;
  readonly assigneeName?: string | null;
  readonly assigneeImageUrl?: string | null;
  readonly isAssigneeOnline?: boolean;
  readonly workItemKey?: string | null;
  readonly titleClassName?: string;
};

/** Shared body used by mention hover cards and Kanban board tiles. */
export function WorkItemPreviewCardBody({
  title,
  type,
  priority,
  descriptionPlain,
  assigneeName,
  assigneeImageUrl,
  isAssigneeOnline,
  workItemKey,
  titleClassName,
}: Readonly<WorkItemPreviewCardProps>) {
  const name = assigneeName?.trim() || 'Unassigned';

  return (
    <CardContent className="flex min-w-0 flex-col gap-2 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          {workItemKey ? (
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              {workItemKey}
            </p>
          ) : null}
          <TruncatedText
            className={cn(
              'text-foreground min-w-0 text-sm leading-snug font-semibold',
              titleClassName
            )}
          >
            {title}
          </TruncatedText>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <UserAvatar
                name={name}
                imageUrl={assigneeImageUrl}
                title={name}
                isOnline={isAssigneeOnline}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{name}</TooltipContent>
        </Tooltip>
      </div>

      {descriptionPlain ? (
        <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
          {descriptionPlain}
        </p>
      ) : null}

      <Separator className="my-1" />

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <WorkItemTypeBadge type={type} className="max-w-full truncate" />
        {priority ? <PriorityBadge priority={priority} /> : null}
      </div>
    </CardContent>
  );
}

/** Compact Kanban-style preview for #work-item mention hover cards. */
export function WorkItemPreviewCard({
  className,
  ...bodyProps
}: Readonly<WorkItemPreviewCardProps & { className?: string }>) {
  return (
    <Card className={cn('w-72 border shadow-sm', className)}>
      <WorkItemPreviewCardBody {...bodyProps} />
    </Card>
  );
}
