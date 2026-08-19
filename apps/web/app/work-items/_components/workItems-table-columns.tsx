'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { parseWorkItemLabels } from '@repo/types';
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
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { formatDate } from '@/app/_shared/utility';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import { WorkItemOverdueBadge } from '@/app/work-items/_components/workItem-badge-overdue';
import { WorkItemTypeBadge } from '@/app/work-items/_components/workItem-badge-type';
import { WorkItemLabelsTrain } from '@/app/work-items/_components/work-item-labels-train';
import type {
  DisplayRow,
  HierarchyRendererProps,
} from '@/app/work-items/_components/workItems-table-types';
import type { WorkItemWorkspaceProps } from '@/app/work-items/_components/workItems-workspace';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { isWorkItemOverdue } from '@/app/work-items/_helpers/work-item-due-date';
import { workItemDetailHref } from '@/app/work-items/_helpers/work-item-links';
import { RegistryTitleCell } from '@/components/registry-title-cell';
import { UserAvatar } from '@/components/user-avatar';

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
    <RegistryTitleCell
      className={indentClass}
      href={workItemDetailHref(workItem.id, {
        fromProjectId,
        fromAssigneeId,
      })}
      title={workItem.title}
      subtitle={`Created ${formatDate(workItem.created_at)}`}
      leading={
        isHierarchy ? (
          <div className="flex size-7 shrink-0 items-center justify-center">
            {canExpand ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 cursor-pointer"
                aria-label={
                  isExpanded ? 'Collapse subtasks' : 'Expand subtasks'
                }
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
        ) : null
      }
    />
  );
};

function personRenderer({
  person,
  currentUserId,
  personId,
}: Readonly<{
  person: DbWorkItem['assignee'] | DbWorkItem['reporter'] | null | undefined;
  currentUserId?: string | null;
  personId?: string | null;
}>) {
  const name = person?.name ?? '—';
  const isSelf = Boolean(personId && personId === currentUserId);

  if (!person) {
    return <p className="text-muted-foreground font-medium">{name}</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <UserAvatar
        name={person.name}
        imageUrl={person.profile_picture}
        title={name}
      />
      <div className="space-y-1">
        <p className="font-medium">{name}</p>
        {isSelf ? (
          <Badge variant="secondary" className="text-[10px]">
            You
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

const assigneeRenderer = ({
  row,
  currentUserId,
}: HierarchyRendererProps & { currentUserId?: string | null }) =>
  personRenderer({
    person: row.original.workItem.assignee,
    currentUserId,
    personId: row.original.workItem.assignee_id,
  });

const reporterRenderer = ({
  row,
  currentUserId,
}: HierarchyRendererProps & { currentUserId?: string | null }) =>
  personRenderer({
    person: row.original.workItem.reporter,
    currentUserId,
    personId: row.original.workItem.reporter_id,
  });

const dueDateRenderer = ({ row }: HierarchyRendererProps) => {
  const { due_date: dueDate, status } = row.original.workItem;

  if (dueDate && isWorkItemOverdue(dueDate, status)) {
    return <WorkItemOverdueBadge dueDate={dueDate} />;
  }

  return <span className="text-muted-foreground">{formatDate(dueDate)}</span>;
};

function nameByIdMap(
  items: readonly { readonly id: string; readonly name: string }[]
): ReadonlyMap<string, string> {
  return new Map(items.map((item) => [item.id, item.name]));
}

function nameFromMap(
  namesById: ReadonlyMap<string, string>,
  id: string | null | undefined
): string {
  if (!id) {
    return '—';
  }
  return namesById.get(id) ?? '—';
}

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
  readonly projects: WorkItemWorkspaceProps['projects'];
  readonly sprints: readonly Sprint[];
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
    projects,
    sprints,
    onToggleExpand,
    openEditDialog,
  } = options;

  const projectNamesById = nameByIdMap(projects);
  const sprintNamesById = nameByIdMap(sprints);

  const columns: ColumnDef<DisplayRow>[] = [
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
  ];

  if (!lockedProjectId) {
    columns.push({
      id: 'project',
      header: 'Project',
      cell: ({ row }) => {
        const name = nameFromMap(
          projectNamesById,
          row.original.workItem.project_id
        );
        return (
          <TruncatedText className="text-muted-foreground max-w-40 text-sm">
            {name}
          </TruncatedText>
        );
      },
    });
  }

  columns.push(
    {
      id: 'sprint',
      header: 'Sprint',
      cell: ({ row }) => {
        const name = nameFromMap(
          sprintNamesById,
          row.original.workItem.sprint_id
        );
        return (
          <TruncatedText className="text-muted-foreground max-w-40 text-sm">
            {name}
          </TruncatedText>
        );
      },
    },
    {
      id: 'reporter',
      header: 'Reporter',
      cell: ({ row }) => reporterRenderer({ row, currentUserId }),
    },
    {
      id: 'story_points',
      header: 'Story points',
      cell: ({ row }) => {
        const points = row.original.workItem.story_points;
        if (points == null) {
          return <span className="text-muted-foreground">—</span>;
        }
        return <span className="tabular-nums">{points}</span>;
      },
    },
    {
      id: 'labels',
      header: 'Labels',
      cell: ({ row }) => (
        <WorkItemLabelsTrain
          labels={parseWorkItemLabels(row.original.workItem.labels)}
        />
      ),
    },
    {
      id: 'actions',
      header: actionsHeaderRenderer,
      cell: ({ row }) => actionsRenderer({ row, openEditDialog }),
    }
  );

  return columns;
}
