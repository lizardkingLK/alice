'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import { WorkItemTypeBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-type';
import { WorkItemTitleEditor } from '@/app/work-items/_components/work-item-details/work-item-title-editor';
import { formatWorkItemKey } from '@/app/work-items/_helpers/work-item-key';
import {
  resolveStatePresentation,
  resolveWorkItemStatePickerModel,
} from '@/app/work-items/_helpers/workflow-state-options';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import { UserAvatar } from '@/components/user-avatar';

type WorkItemSummaryBannerProps = {
  readonly workItem: DbWorkItem;
  readonly project?: DbProject | null;
  readonly workflowConfig: unknown;
  readonly assigneeOnline?: boolean;
  readonly readOnly?: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onPatched: (updated: Partial<DbWorkItem>) => void;
};

export function WorkItemSummaryBanner({
  workItem,
  project = null,
  workflowConfig,
  assigneeOnline = false,
  readOnly = false,
  onPatched,
}: Readonly<WorkItemSummaryBannerProps>) {
  const picker = resolveWorkItemStatePickerModel({
    workflowConfig,
    workItemType: workItem.type,
    status: workItem.status,
    state: workItem.state,
    boardColumnId: workItem.board_column_id,
  });
  const currentOption =
    picker.options.find((option) => option.id === picker.currentStateId) ??
    null;
  const presentation = resolveStatePresentation({
    category: currentOption?.category,
    status: currentOption?.status ?? workItem.status,
    stateName: picker.currentLabel,
  });
  const Icon = presentation.icon;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-linear-to-r via-transparent to-transparent p-5 md:p-6',
        presentation.borderClass,
        presentation.tintClass
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 px-2.5 py-0.5 font-semibold',
              presentation.borderClass,
              presentation.bgClass,
              presentation.textClass
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {presentation.label}
          </Badge>
          <WorkItemTypeBadge type={workItem.type} />
          <span className="text-muted-foreground font-mono text-xs font-medium">
            {formatWorkItemKey(workItem)}
          </span>
        </div>

        <WorkItemTitleEditor
          workItemId={workItem.id}
          title={workItem.title}
          expectedUpdatedAt={workItem.updated_at}
          onPatched={onPatched}
          readOnly={readOnly}
          className="mt-0"
        />

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {project?.name ? (
            <span className="min-w-0">
              Project:{' '}
              <TruncatedText
                as="span"
                className="text-foreground inline-block max-w-48 align-bottom font-semibold sm:max-w-64"
              >
                {project.name}
              </TruncatedText>
            </span>
          ) : null}
          {workItem.assignee ? (
            <span className="flex items-center gap-2">
              <UserAvatar
                name={workItem.assignee.name}
                imageUrl={workItem.assignee.profile_picture}
                isOnline={assigneeOnline}
                className="h-5 w-5"
              />
              <TruncatedText
                as="span"
                className="text-foreground inline-block max-w-40 font-medium"
              >
                {workItem.assignee.name}
              </TruncatedText>
            </span>
          ) : (
            <span>Unassigned</span>
          )}
        </div>
      </div>
    </div>
  );
}
