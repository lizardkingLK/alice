'use client';

import type { ReactNode } from 'react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { Badge } from '@repo/ui/components/ui/badge';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import { getInitials } from '@/app/_shared/utility';
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
  /** Hierarchy path rendered above the title. */
  readonly breadcrumb?: ReactNode;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onPatched: (updated: Partial<DbWorkItem>) => void;
};

export function WorkItemSummaryBanner({
  workItem,
  project = null,
  workflowConfig,
  assigneeOnline = false,
  readOnly = false,
  breadcrumb,
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
  const projectFallback =
    project?.key?.trim().slice(0, 2).toUpperCase() ||
    getInitials(project?.name);

  return (
    <div
      className={cn(
        // Full-bleed band to DashboardShell edges; content column matches body.
        '-mx-6 -mt-6 w-[calc(100%+3rem)] border-0 border-b bg-linear-to-r via-transparent to-transparent px-6 pt-6 pb-5 md:pb-6',
        presentation.borderClass,
        presentation.tintClass
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
        {breadcrumb ? <div className="min-w-0">{breadcrumb}</div> : null}

        <WorkItemTitleEditor
          workItemId={workItem.id}
          title={workItem.title}
          expectedUpdatedAt={workItem.updated_at}
          onPatched={onPatched}
          readOnly={readOnly}
          className="mt-0"
        />

        <div className="flex flex-wrap items-center gap-2">
          {project?.name ? (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar
                size="sm"
                className="border-primary/20 size-6 shrink-0 border"
                title={project.name}
              >
                {project.logo_url ? (
                  <AvatarImage
                    src={project.logo_url}
                    alt={`${project.name} logo`}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                  {projectFallback}
                </AvatarFallback>
              </Avatar>
              <TruncatedText
                as="span"
                className="text-foreground inline-block max-w-40 text-sm font-medium sm:max-w-56"
              >
                {project.name}
              </TruncatedText>
            </div>
          ) : null}
          {workItem.assignee ? (
            <div className="mr-1 flex min-w-0 items-center gap-2">
              <UserAvatar
                name={workItem.assignee.name}
                imageUrl={workItem.assignee.profile_picture}
                isOnline={assigneeOnline}
                className="size-6"
              />
              <TruncatedText
                as="span"
                className="text-foreground inline-block max-w-36 text-sm font-medium"
              >
                {workItem.assignee.name}
              </TruncatedText>
            </div>
          ) : null}
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
          <Badge
            variant="outline"
            className="text-muted-foreground font-mono text-xs font-medium"
          >
            {formatWorkItemKey(workItem)}
          </Badge>
        </div>
      </div>
    </div>
  );
}
