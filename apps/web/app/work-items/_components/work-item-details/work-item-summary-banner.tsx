'use client';

import type { ComponentType, ReactNode } from 'react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import { getInitials } from '@/app/_shared/utility';
import { WorkItemTitleEditor } from '@/app/work-items/_components/work-item-details/work-item-title-editor';
import type {
  WorkItemDetailsPreferences,
  WorkItemTitleIconSource,
} from '@/app/work-items/_helpers/work-item-details-preferences';
import {
  WORK_ITEM_TYPE_BORDER,
  WORK_ITEM_TYPE_ICONS,
  WORK_ITEM_TYPE_TINT,
} from '@/app/work-items/_helpers/work-item-type';
import {
  resolveStatePresentation,
  resolveWorkItemStatePickerModel,
  type StatePresentation,
} from '@/app/work-items/_helpers/workflow-state-options';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import { UserAvatar } from '@/components/user-avatar';
import type { WorkItemType } from '@repo/types';

type WorkItemSummaryBannerProps = {
  readonly workItem: DbWorkItem;
  readonly project?: DbProject | null;
  readonly workflowConfig: unknown;
  readonly assigneeOnline?: boolean;
  readonly readOnly?: boolean;
  /** Hierarchy path rendered above the title. */
  readonly breadcrumb?: ReactNode;
  readonly preferences: WorkItemDetailsPreferences;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onPatched: (updated: Partial<DbWorkItem>) => void;
};

/** Match title line box (text-2xl / sm:text-3xl) for optical centering. */
const TITLE_ICON_CLASS = 'text-foreground size-7 shrink-0 sm:size-8';

type TitleIconComponent = ComponentType<{
  readonly className?: string;
  readonly 'aria-hidden'?: boolean | 'true' | 'false';
}>;

function isWorkItemType(value: string): value is WorkItemType {
  return value in WORK_ITEM_TYPE_ICONS;
}

function resolveBannerSurfaceClasses(params: {
  readonly bannerColor: WorkItemDetailsPreferences['bannerColor'];
  readonly workItemType: WorkItemType | null;
  readonly presentation: StatePresentation;
}): { readonly borderClass: string; readonly tintClass: string } {
  const { bannerColor, workItemType, presentation } = params;
  if (bannerColor === 'type' && workItemType) {
    return {
      borderClass: WORK_ITEM_TYPE_BORDER[workItemType],
      tintClass: WORK_ITEM_TYPE_TINT[workItemType],
    };
  }
  return {
    borderClass: presentation.borderClass,
    tintClass: presentation.tintClass,
  };
}

function resolveTitleIconNode(params: {
  readonly titleIcon: WorkItemTitleIconSource;
  readonly TypeIcon: TitleIconComponent | null;
  readonly StateIcon: TitleIconComponent;
}): ReactNode {
  const { titleIcon, TypeIcon, StateIcon } = params;

  if (titleIcon === 'type' && TypeIcon) {
    return <TypeIcon className={TITLE_ICON_CLASS} aria-hidden />;
  }

  if (titleIcon === 'state') {
    return <StateIcon className={TITLE_ICON_CLASS} aria-hidden />;
  }

  return null;
}

export function WorkItemSummaryBanner({
  workItem,
  project = null,
  workflowConfig,
  assigneeOnline = false,
  readOnly = false,
  breadcrumb,
  preferences,
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
  const workItemType = isWorkItemType(workItem.type) ? workItem.type : null;
  const TypeIcon = workItemType ? WORK_ITEM_TYPE_ICONS[workItemType] : null;
  const { borderClass: bannerBorderClass, tintClass: bannerTintClass } =
    resolveBannerSurfaceClasses({
      bannerColor: preferences.bannerColor,
      workItemType,
      presentation,
    });
  const titleIcon = resolveTitleIconNode({
    titleIcon: preferences.titleIcon,
    TypeIcon,
    StateIcon: presentation.icon,
  });

  const projectFallback =
    project?.key?.trim().slice(0, 2).toUpperCase() ||
    getInitials(project?.name);

  return (
    <div
      className={cn(
        // Full-bleed band to DashboardShell edges; content column matches body.
        '-mx-6 -mt-6 w-[calc(100%+3rem)] border-0 border-b bg-linear-to-r via-transparent to-transparent px-6 pt-6 pb-5 md:pb-6',
        bannerBorderClass,
        bannerTintClass
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
        {breadcrumb ? <div className="min-w-0">{breadcrumb}</div> : null}

        <div className="flex items-center gap-3">
          {titleIcon ? (
            <span className="inline-flex shrink-0 items-center justify-center self-center leading-none">
              {titleIcon}
            </span>
          ) : null}
          <WorkItemTitleEditor
            workItemId={workItem.id}
            title={workItem.title}
            expectedUpdatedAt={workItem.updated_at}
            onPatched={onPatched}
            readOnly={readOnly}
            className="mt-0 min-w-0 flex-1 items-center"
          />
        </div>

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
        </div>
      </div>
    </div>
  );
}
