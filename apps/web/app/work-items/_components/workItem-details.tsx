'use client';

import { ReactNode, useMemo, useState } from 'react';
import type { Json } from '@repo/types';
import { formatDate, formatLabelWithSpace } from '@/app/_shared/utility';
import { PriorityBadge } from '@/app/work-items/_components/workItem-priority-badge';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-status-badge';
import { DbWorkItem } from '@/app/work-items/_services/workItem.server.service';
import { Avatar, AvatarFallback } from '@repo/ui/components/ui/avatar';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { ButtonGroup } from '@repo/ui/components/ui/button-group';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { Progress } from '@repo/ui/components/ui/progress';
import { Separator } from '@repo/ui/components/ui/separator';
import { cn } from '@repo/ui/lib/utils';
import {
  CheckCircle2,
  ChevronDown,
  Cloud,
  FileImage,
  FileText,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Rocket,
  Settings,
} from 'lucide-react';

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

const PLACEHOLDER_ATTACHMENTS = [
  {
    id: '1',
    name: 'Requirements.pdf',
    meta: '10 Apr 2020 10:01 pm',
    kind: 'pdf' as const,
  },
  {
    id: '2',
    name: 'wireframe-hero.png',
    meta: '10 Apr 2020 10:01 pm',
    kind: 'image' as const,
  },
  {
    id: '3',
    name: 'Spec-notes.docx',
    meta: '9 Apr 2020 4:22 pm',
    kind: 'doc' as const,
  },
  {
    id: '4',
    name: 'flow-diagram.png',
    meta: '8 Apr 2020 11:15 am',
    kind: 'image' as const,
  },
] as const;

const PLACEHOLDER_CHILD_ISSUES = [
  {
    id: 'c1',
    key: 'ISSUE-101',
    title: 'Define API contract for helper microservice',
    comments: 4,
    status: 'ToDo' as const,
  },
  {
    id: 'c2',
    key: 'ISSUE-102',
    title: 'Add authentication middleware',
    comments: 2,
    status: 'InProgress' as const,
  },
  {
    id: 'c3',
    key: 'ISSUE-103',
    title: 'Write integration tests',
    comments: 1,
    status: 'New' as const,
  },
] as const;

function extractDescriptionText(description: Json | null): string {
  if (!description) {
    return 'No description provided.';
  }

  if (typeof description === 'string') {
    return description;
  }

  if (typeof description !== 'object' || Array.isArray(description)) {
    return 'No description provided.';
  }

  const content = description.content;
  if (!Array.isArray(content)) {
    return 'No description provided.';
  }

  const paragraphs = content
    .map((block) => {
      if (
        typeof block === 'object' &&
        block !== null &&
        !Array.isArray(block) &&
        typeof block.text === 'string'
      ) {
        return block.text;
      }
      return null;
    })
    .filter((text): text is string => Boolean(text));

  return paragraphs.length > 0
    ? paragraphs.join('\n\n')
    : 'No description provided.';
}

function getInitials(name: string | null | undefined): string {
  if (!name) {
    return '?';
  }

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function UserPill({
  name,
  emptyLabel = 'Unassigned',
}: Readonly<{ name?: string | null; emptyLabel?: string }>) {
  const displayName = name?.trim() || emptyLabel;

  return (
    <div className="flex items-center gap-2">
      <Avatar size="sm">
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{displayName}</span>
    </div>
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

function AttachmentCard({
  name,
  meta,
  kind,
}: Readonly<{
  name: string;
  meta: string;
  kind: 'pdf' | 'image' | 'doc';
}>) {
  return (
    <Card
      className={cn(
        'border-border bg-card min-w-42 shrink-0 overflow-hidden py-0 shadow-none'
      )}
    >
      <div
        className={cn(
          'bg-muted flex h-24 items-center justify-center border-b'
        )}
      >
        {kind === 'image' ? (
          <FileImage className="text-muted-foreground size-8" />
        ) : (
          <FileText className="text-muted-foreground size-8" />
        )}
      </div>
      <CardContent className="space-y-0.5 px-3 py-2.5">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-muted-foreground text-xs">{meta}</p>
      </CardContent>
    </Card>
  );
}

export default function WorkItemDetails({
  workItem,
}: Readonly<{ workItem: DbWorkItem }>) {
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [moreFieldsOpen, setMoreFieldsOpen] = useState(false);

  const description = useMemo(
    () => extractDescriptionText(workItem.description),
    [workItem.description]
  );

  const childDonePercent = 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Title + actions */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{workItem.type}</Badge>
              <span className="text-muted-foreground font-mono text-xs">
                {workItem.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {workItem.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="sm" className="cursor-pointer">
            <Paperclip data-icon="inline-start" />
            Attach
          </Button>
          <Button variant="ghost" size="sm" className="cursor-pointer">
            <Plus data-icon="inline-start" />
            Create subtask
          </Button>
          <Button variant="ghost" size="sm" className="cursor-pointer">
            <Link2 data-icon="inline-start" />
            Link issue
            <ChevronDown data-icon="inline-end" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Main column */}
        <div className="space-y-8 lg:col-span-3">
          {/* Description */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Description</h2>
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
              {description}
            </p>
          </section>

          <Separator />

          {/* Attachments */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                Attachments{' '}
                <span className="text-muted-foreground font-normal">
                  ({PLACEHOLDER_ATTACHMENTS.length})
                </span>
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="Add attachment"
                >
                  <Plus />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="More attachment actions"
                >
                  <MoreHorizontal />
                </Button>
              </div>
            </div>

            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {PLACEHOLDER_ATTACHMENTS.map((attachment) => (
                <AttachmentCard
                  key={attachment.id}
                  name={attachment.name}
                  meta={attachment.meta}
                  kind={attachment.kind}
                />
              ))}
            </div>
          </section>

          <Separator />

          {/* Child issues */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Child issues</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="cursor-pointer">
                  Order by
                  <ChevronDown data-icon="inline-end" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="More child issue actions"
                >
                  <MoreHorizontal />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="Add child issue"
                >
                  <Plus />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Progress value={childDonePercent} className="h-1.5 flex-1" />
              <span className="text-muted-foreground shrink-0 text-xs">
                {childDonePercent}% Done
              </span>
            </div>

            <ul className="divide-border divide-y rounded-lg border">
              {PLACEHOLDER_CHILD_ISSUES.map((child) => (
                <li
                  key={child.id}
                  className={cn(
                    'hover:bg-muted/40 flex flex-wrap items-center gap-3 px-3 py-2.5 transition-colors'
                  )}
                >
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {child.key}
                  </Badge>
                  <p className="min-w-0 flex-1 truncate text-sm">
                    {child.title}
                  </p>
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <MessageSquare className="size-3.5" />
                    {child.comments}
                  </span>
                  <PriorityBadge priority={workItem.priority} />
                  <Avatar size="sm">
                    <AvatarFallback>
                      {getInitials(workItem.assignee?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <WorkItemStatusBadge status={child.status} />
                </li>
              ))}
            </ul>
          </section>

          <Separator />

          {/* Linked issues */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Linked issues</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                aria-label="Link issue"
              >
                <Plus />
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">is blocked by</p>
            <div
              className={cn(
                'text-muted-foreground flex h-16 items-center justify-center rounded-lg border border-dashed text-sm'
              )}
            >
              No linked issues yet
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:col-span-2">
          <StatusDropdown workItemStatus={workItem.status} />

          <Card className="border-border gap-0 py-0 shadow-none">
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CardHeader className="px-4 py-3">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'hover:bg-muted/50 flex w-full cursor-pointer items-center justify-between rounded-md text-left transition-colors'
                    )}
                  >
                    <CardTitle className="text-sm font-semibold">
                      Details
                    </CardTitle>
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
                    <UserPill name={workItem.assignee?.name} />
                  </DetailRow>
                  <DetailRow label="Reporter">
                    <UserPill
                      name={workItem.reporter?.name}
                      emptyLabel="Unknown"
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
                          <GitCommit className="text-muted-foreground size-3.5" />
                          1 commit
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
                          <Rocket className="text-muted-foreground size-3.5" />
                          1 build
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
                <CollapsibleTrigger asChild>
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
        </aside>
      </div>
    </div>
  );
}
