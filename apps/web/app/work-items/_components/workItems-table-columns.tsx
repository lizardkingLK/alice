'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Pencil,
} from '@repo/ui/lib/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { formatDate } from '@/app/_shared/utility';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import { WorkItemTypeBadge } from '@/app/work-items/_components/workItem-badge-type';
import type {
  DisplayRow,
  HierarchyRendererProps,
} from '@/app/work-items/_components/workItems-table-types';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { workItemDetailHref } from '@/app/work-items/_helpers/work-item-links';
import { UserAvatar } from '@/components/user-avatar';
import Link from 'next/link';
import { cn } from '@repo/ui/lib/utils';

const TITLE_INDENT_CLASS = ['pl-0', 'pl-4', 'pl-8', 'pl-12'] as const;

function HierarchyExpandIcon({
  isLoading,
  isExpanded,
}: Readonly<{ isLoading: boolean; isExpanded: boolean }>) {
  if (isLoading) {
    return <Loader2 className="size-4 animate-spin" />;
  }
  if (isExpanded) {
    return <ChevronDown className="size-4" />;
  }
  return <ChevronRight className="size-4" />;
}

const titleRenderer = ({
  row,
  fromProjectId,
  fromAssigneeId,
  isHierarchy,
  onToggleExpand,
}: HierarchyRendererProps & {
  fromProjectId?: string | null;
  fromAssigneeId?: string | null;
  isHierarchy: boolean;
  // eslint-disable-next-line no-unused-vars -- expand toggle callback
  onToggleExpand?: (workItemId: string) => void;
}) => {
  const { workItem, depth, canExpand, isExpanded, isLoading } = row.original;
  const indentClass =
    TITLE_INDENT_CLASS[Math.min(depth, TITLE_INDENT_CLASS.length - 1)] ??
    'pl-12';

  return (
    <div className={cn('flex min-w-48 items-center gap-2', indentClass)}>
      {isHierarchy ? (
        <div className="flex size-7 shrink-0 items-center justify-center">
          {canExpand ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7 cursor-pointer"
              aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
              aria-expanded={isExpanded}
              disabled={isLoading}
              onClick={(event) => {
                event.preventDefault();
                onToggleExpand?.(workItem.id);
              }}
            >
              <HierarchyExpandIcon
                isLoading={isLoading}
                isExpanded={isExpanded}
              />
            </Button>
          ) : (
            <span className="size-7" aria-hidden />
          )}
        </div>
      ) : null}
      <Link
        className="flex min-w-0 flex-1 items-center gap-3"
        href={workItemDetailHref(workItem.id, {
          fromProjectId,
          fromAssigneeId,
        })}
      >
        <div
          className={cn(
            'bg-primary/10 text-primary border-primary/20',
            'flex size-8 shrink-0 items-center justify-center',
            'rounded-lg border text-xs font-bold'
          )}
        >
          {workItem.title.slice(0, 1).toUpperCase()}
        </div>
        <div className="space-y-1 font-medium">
          {workItem.title}
          <p className="text-muted-foreground text-xs">
            Created {formatDate(workItem.created_at)}
          </p>
        </div>
      </Link>
    </div>
  );
};

const assigneeRenderer = ({
  row,
  currentUserId,
}: HierarchyRendererProps & { currentUserId?: string | null }) => {
  const assignee = row.original.workItem.assignee;
  const assigneeName = assignee?.name ?? '—';
  const isAssignedToSelf = row.original.workItem.assignee_id === currentUserId;

  if (!assignee) {
    return <p className="text-muted-foreground font-medium">{assigneeName}</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <UserAvatar
        name={assignee.name}
        imageUrl={assignee.profile_picture}
        title={assigneeName}
      />
      <div className="space-y-1">
        <p className="font-medium">{assigneeName}</p>
        {isAssignedToSelf ? (
          <Badge variant="secondary" className="text-[10px]">
            You
          </Badge>
        ) : null}
      </div>
    </div>
  );
};

const dueDateRenderer = ({ row }: HierarchyRendererProps) => (
  <span className="text-muted-foreground">
    {formatDate(row.original.workItem.due_date)}
  </span>
);

const actionsHeaderRenderer = () => <span className="sr-only">Actions</span>;

const actionsRenderer = ({
  row,
  openEditDialog,
}: HierarchyRendererProps & {
  // eslint-disable-next-line no-unused-vars -- edit dialog opener
  openEditDialog: (workItem: DbWorkItem) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon-sm" className="cursor-pointer">
        <MoreHorizontal />
        <span className="sr-only">Open menu</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => openEditDialog(row.original.workItem)}>
        <Pencil />
        Edit
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export function buildWorkItemColumns(options: {
  readonly lockedProjectId?: string;
  readonly lockedAssigneeId?: string;
  readonly isHierarchy: boolean;
  readonly currentUserId?: string | null;
  // eslint-disable-next-line no-unused-vars -- expand toggle callback
  readonly onToggleExpand: (workItemId: string) => void;
  // eslint-disable-next-line no-unused-vars -- edit dialog opener
  readonly openEditDialog: (workItem: DbWorkItem) => void;
}): ColumnDef<DisplayRow>[] {
  const {
    lockedProjectId,
    lockedAssigneeId,
    isHierarchy,
    currentUserId,
    onToggleExpand,
    openEditDialog,
  } = options;

  return [
    {
      id: 'title',
      header: 'Title',
      cell: ({ row }) =>
        titleRenderer({
          row,
          fromProjectId: lockedProjectId,
          fromAssigneeId: lockedAssigneeId,
          isHierarchy,
          onToggleExpand,
        }),
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <WorkItemTypeBadge type={row.original.workItem.type} />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <WorkItemStatusBadge status={row.original.workItem.status} />
      ),
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: ({ row }) => (
        <PriorityBadge priority={row.original.workItem.priority} />
      ),
    },
    {
      id: 'assignee',
      header: 'Assignee',
      cell: ({ row }) => assigneeRenderer({ row, currentUserId }),
    },
    {
      id: 'due_date',
      header: 'Due Date',
      cell: dueDateRenderer,
    },
    {
      id: 'actions',
      header: actionsHeaderRenderer,
      cell: ({ row }) => actionsRenderer({ row, openEditDialog }),
    },
  ];
}
