'use client';

import {
  formatLabelWithSpace,
  formatDate,
  getInitials,
} from '@/app/_shared/utility';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import {
  WORK_ITEM_PATCH_FIELD_CONFIG,
  WorkItemFieldPatchDialog,
  type WorkItemPatchFieldId,
  type WorkItemPatchMemberOption,
} from '@/app/work-items/_components/workItem-field-patch-dialog';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { Button } from '@repo/ui/components/ui/button';
import { ButtonGroup } from '@repo/ui/components/ui/button-group';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import {
  CollapsibleTrigger,
  CollapsibleContent,
  Collapsible,
} from '@repo/ui/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  ChevronDown,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Rocket,
  CheckCircle2,
  Cloud,
  PencilIcon,
  Settings,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { Dispatch, ReactNode, SetStateAction, useState } from 'react';

const statuses = [
  'Draft',
  'New',
  'ToDo',
  'InProgress',
  'Testing',
  'Done',
] as const satisfies ReadonlyArray<DbWorkItem['status']>;

const PLACEHOLDER_LABELS = [
  'Solar-powered',
  'Mobile',
  'Desktop',
  'IT2',
] as const;

function StatusDropdown({
  workItemStatus,
}: Readonly<{ workItemStatus: DbWorkItem['status'] }>) {
  const [status, setStatus] = useState(workItemStatus);

  return (
    <ButtonGroup className="w-full">
      <Button
        variant="default"
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 justify-start"
      >
        {formatLabelWithSpace(status)}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" className="cursor-pointer px-2">
            <ChevronDown />
            <span className="sr-only">Change status</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={status}
              onValueChange={(value) =>
                setStatus(value as DbWorkItem['status'])
              }
            >
              {statuses.map((item) => (
                <DropdownMenuRadioItem key={item} value={item}>
                  {formatLabelWithSpace(item)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}

function DetailRow({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-start gap-3 py-2.5">
      <span className="text-muted-foreground pt-0.5 text-sm">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function UserPill({
  name,
  imageUrl,
  emptyLabel = 'Unassigned',
}: Readonly<{
  name?: string | null;
  imageUrl?: string | null;
  emptyLabel?: string;
}>) {
  const displayName = name?.trim() || emptyLabel;

  return (
    <div className="flex items-center gap-2">
      <Avatar size="sm">
        {imageUrl ? <AvatarImage src={imageUrl} alt={displayName} /> : null}
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{displayName}</span>
    </div>
  );
}

/* eslint-disable no-unused-vars */
type EditableUserFieldProps = {
  readonly name?: string | null;
  readonly imageUrl?: string | null;
  readonly field: WorkItemPatchFieldId;
  readonly onEdit: (field: WorkItemPatchFieldId) => void;
};
/* eslint-enable no-unused-vars */

function EditableUserField({
  name,
  imageUrl,
  field,
  onEdit,
}: Readonly<EditableUserFieldProps>) {
  const config = WORK_ITEM_PATCH_FIELD_CONFIG[field];

  return (
    <div className="flex items-center justify-between gap-2">
      <UserPill
        name={name}
        imageUrl={imageUrl}
        emptyLabel={config.unassignedLabel}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="cursor-pointer"
        aria-label={`Edit ${config.label.toLowerCase()}`}
        onClick={() => onEdit(field)}
      >
        <PencilIcon className="size-3.5" />
      </Button>
    </div>
  );
}

export default function WorkItemSidebar({
  workItem,
  projectMembers = [],
  detailsOpen,
  setDetailsOpen,
  moreFieldsOpen,
  setMoreFieldsOpen,
  onWorkItemPatched,
}: Readonly<{
  workItem: DbWorkItem;
  projectMembers?: readonly WorkItemPatchMemberOption[];
  detailsOpen: boolean;
  setDetailsOpen: Dispatch<SetStateAction<boolean>>;
  moreFieldsOpen: boolean;
  setMoreFieldsOpen: Dispatch<SetStateAction<boolean>>;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onWorkItemPatched: (updated: Partial<DbWorkItem>) => void;
}>) {
  const [activeField, setActiveField] = useState<WorkItemPatchFieldId | null>(
    null
  );

  const activeConfig = activeField
    ? WORK_ITEM_PATCH_FIELD_CONFIG[activeField]
    : null;

  let currentValue: string | null = null;
  if (activeField === 'assignee_id') {
    currentValue = workItem.assignee_id;
  } else if (activeField === 'reporter_id') {
    currentValue = workItem.reporter_id;
  }

  return (
    <aside className="space-y-4 lg:col-span-2">
      <StatusDropdown workItemStatus={workItem.status} />

      <Card className="border-border gap-0 py-0 shadow-none">
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CardHeader className="px-4 py-3">
            <CollapsibleTrigger
              className="bg-transparent hover:bg-transparent"
              asChild
            >
              <button
                type="button"
                className={cn(
                  'hover:bg-muted/50 flex w-full cursor-pointer items-center justify-between rounded-md text-left transition-colors'
                )}
              >
                <CardTitle className="text-sm font-semibold">Details</CardTitle>
                <ChevronDown
                  className={cn(
                    'text-muted-foreground size-4 transition-transform',
                    detailsOpen && 'rotate-180'
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="border-t px-4 pt-1 pb-4">
              <DetailRow label="Assignee">
                <EditableUserField
                  name={workItem.assignee?.name}
                  imageUrl={workItem.assignee?.profile_picture}
                  field="assignee_id"
                  onEdit={setActiveField}
                />
              </DetailRow>
              <DetailRow label="Reporter">
                <EditableUserField
                  name={workItem.reporter?.name}
                  imageUrl={workItem.reporter?.profile_picture}
                  field="reporter_id"
                  onEdit={setActiveField}
                />
              </DetailRow>
              <DetailRow label="Priority">
                <PriorityBadge priority={workItem.priority} />
              </DetailRow>
              <DetailRow label="Labels">
                <div className="flex flex-wrap gap-1.5">
                  {PLACEHOLDER_LABELS.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
              </DetailRow>

              <DetailRow label="Development">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <GitBranch className="text-muted-foreground size-3.5" />
                    <span>1 branch</span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <GitCommit className="text-muted-foreground size-3.5" />1
                      commit
                    </span>
                    <span className="text-muted-foreground text-xs">
                      yesterday
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <GitPullRequest className="text-muted-foreground size-3.5" />
                      1 pull request
                    </span>
                    <Badge variant="secondary">OPEN</Badge>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <Rocket className="text-muted-foreground size-3.5" />1
                      build
                    </span>
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </li>
                </ul>
              </DetailRow>

              <DetailRow label="Releases">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <Cloud className="text-muted-foreground size-3.5" />
                      Production
                    </span>
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto cursor-pointer px-0"
                  >
                    + Add feature flag
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-muted-foreground h-auto cursor-pointer px-0"
                  >
                    See all deployments
                  </Button>
                </div>
              </DetailRow>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card className="border-border gap-0 py-0 shadow-none">
        <Collapsible open={moreFieldsOpen} onOpenChange={setMoreFieldsOpen}>
          <CardHeader className="px-4 py-3">
            <CollapsibleTrigger
              className="bg-transparent hover:bg-transparent"
              asChild
            >
              <button
                type="button"
                className={cn(
                  'hover:bg-muted/50 flex w-full cursor-pointer items-center justify-between gap-3 rounded-md text-left transition-colors'
                )}
              >
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold">
                    More fields
                  </CardTitle>
                  {!moreFieldsOpen ? (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      Time tracking, automation, reminders…
                    </p>
                  ) : null}
                </div>
                <ChevronDown
                  className={cn(
                    'text-muted-foreground size-4 shrink-0 transition-transform',
                    moreFieldsOpen && 'rotate-180'
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="text-muted-foreground space-y-3 border-t px-4 pt-3 pb-4 text-sm">
              <DetailRow label="Due date">
                <span>{formatDate(workItem.due_date)}</span>
              </DetailRow>
              <DetailRow label="Story points">
                <span>{workItem.story_points ?? '—'}</span>
              </DetailRow>
              <DetailRow label="Sprint">
                <span>{workItem.sprint_id ? 'Assigned' : 'Backlog'}</span>
              </DetailRow>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <div className="text-muted-foreground space-y-1 px-1 text-xs">
        <p>Created {formatDate(workItem.created_at)}</p>
        <p>Updated {formatDate(workItem.updated_at)}</p>
        {workItem.status === 'Done' ? (
          <p>Resolved {formatDate(workItem.updated_at)}</p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="cursor-pointer">
          <Settings data-icon="inline-start" />
          Configure
        </Button>
      </div>

      {activeConfig ? (
        <WorkItemFieldPatchDialog
          open={!!activeField}
          onOpenChange={(open) => {
            if (!open) {
              setActiveField(null);
            }
          }}
          workItemId={workItem.id}
          fieldConfig={activeConfig}
          options={projectMembers}
          currentValue={currentValue}
          onPatched={onWorkItemPatched}
        />
      ) : null}
    </aside>
  );
}
