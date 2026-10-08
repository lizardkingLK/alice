'use client';

import { formatRelativeTime } from '@/app/_shared/utility';
import { UserAvatar } from '@/components/user-avatar';
import type {
  AttachmentActivityMeta,
  WorkItemActivity,
  WorkflowTransitionMeta,
} from '@repo/types';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import { History } from '@repo/ui/lib/icons';

type WorkItemActivityFeedProps = {
  activities: WorkItemActivity[];
};

function actorName(activity: WorkItemActivity): string {
  return activity.actor?.name?.trim() || 'Someone';
}

function isAttachmentMeta(meta: unknown): meta is AttachmentActivityMeta {
  if (!meta || typeof meta !== 'object') {
    return false;
  }
  const record = meta as Record<string, unknown>;
  return (
    typeof record.attachmentId === 'string' &&
    typeof record.fileName === 'string'
  );
}

function isTransitionMeta(meta: unknown): meta is WorkflowTransitionMeta {
  if (!meta || typeof meta !== 'object') {
    return false;
  }
  const record = meta as Record<string, unknown>;
  return (
    typeof record.fromStateId === 'string' &&
    typeof record.toStateId === 'string' &&
    typeof record.workflowId === 'string'
  );
}

function formatFieldLabel(field: string | null): string {
  if (!field) {
    return 'a field';
  }
  return field.replaceAll('_', ' ');
}

function describeActivity(activity: WorkItemActivity): string {
  const who = actorName(activity);

  switch (activity.action) {
    case 'created':
      return `${who} created this work item`;
    case 'attachment_added': {
      const fileName = isAttachmentMeta(activity.meta)
        ? activity.meta.fileName
        : 'a file';
      return `${who} added attachment ${fileName}`;
    }
    case 'attachment_removed': {
      const fileName = isAttachmentMeta(activity.meta)
        ? activity.meta.fileName
        : 'a file';
      return `${who} removed attachment ${fileName}`;
    }
    case 'workflow_transition': {
      if (isTransitionMeta(activity.meta)) {
        return `${who} moved from ${activity.meta.fromStateId} to ${activity.meta.toStateId}`;
      }
      return `${who} changed workflow state`;
    }
    case 'escalation_resolved':
      return `${who} resolved an escalation`;
    case 'commented':
      return `${who} commented`;
    case 'field_changed': {
      const field = formatFieldLabel(activity.field);
      if (activity.field === 'description') {
        return `${who} updated the description`;
      }
      const from = activity.old_value ?? 'empty';
      const to = activity.new_value ?? 'empty';
      return `${who} changed ${field} from ${from} to ${to}`;
    }
    default:
      return `${who} made a change`;
  }
}

export function WorkItemActivityFeed({
  activities,
}: Readonly<WorkItemActivityFeedProps>) {
  if (activities.length === 0) {
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

  return (
    <ul className="space-y-3">
      {activities.map((activity) => {
        const name = actorName(activity);
        return (
          <li
            key={activity.id}
            className="flex items-start gap-3 rounded-lg border px-3 py-3"
          >
            <UserAvatar
              name={name}
              imageUrl={activity.actor?.profile_picture}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm leading-snug">
                {describeActivity(activity)}
              </p>
              <p
                className="text-muted-foreground text-xs"
                title={activity.created_at}
              >
                {formatRelativeTime(activity.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
