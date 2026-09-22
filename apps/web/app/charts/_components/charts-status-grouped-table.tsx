'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { BOARD_WORK_ITEM_STATUSES, type WorkItemStatus } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { ChartsTableColumnId } from '@/app/charts/_components/charts.types';
import {
  CHARTS_TABLE_COLUMN_LABELS,
  DEFAULT_CHARTS_VISIBLE_TABLE_COLUMNS,
} from '@/app/charts/_components/charts.types';
import type { ChartDrilldownTableItem } from '@/app/charts/_helpers/charts-analytics.ui';
import { ChartsEmptyState } from '@/app/charts/_components/charts-empty-state';
import { WorkItemStatusBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-status';
import { WorkItemTypeBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-type';
import { PriorityBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-priority';
import { STATUS_META } from '@/app/work-items/_helpers/work-item-status';
import { GroupedItemsPaginatedTable } from '@/components/grouped-items/grouped-items-paginated-table';
import { GroupedItemsSection } from '@/components/grouped-items/grouped-items-section';
import { UserAvatar } from '@/components/user-avatar';

type ChartsStatusGroupedTableProps = {
  readonly workItems: readonly ChartDrilldownTableItem[];
  /** When set, only this status group is shown (pie-slice filter). */
  readonly focusedStatus?: WorkItemStatus | null;
  readonly loading?: boolean;
  /** When `undefined` / empty, hide the empty state (e.g. dialog closing). */
  readonly emptyMessage?: string;
  readonly className?: string;
  readonly visibleColumns?: readonly ChartsTableColumnId[];
  // eslint-disable-next-line no-unused-vars -- edit opener
  readonly onEditWorkItem?: (item: ChartDrilldownTableItem) => void;
};

/**
 * Board-order status groups (New → … → Done). Empty groups are omitted unless
 * a pie-slice focus pins one status (even when that group has no rows).
 */
export function buildChartStatusGroups(
  workItems: readonly ChartDrilldownTableItem[],
  focusedStatus: WorkItemStatus | null = null
): readonly {
  readonly status: WorkItemStatus;
  readonly items: ChartDrilldownTableItem[];
}[] {
  const statuses = focusedStatus
    ? BOARD_WORK_ITEM_STATUSES.filter((status) => status === focusedStatus)
    : BOARD_WORK_ITEM_STATUSES;

  return statuses
    .map((status) => ({
      status,
      items: workItems.filter((item) => item.status === status),
    }))
    .filter((group) => focusedStatus != null || group.items.length > 0);
}

function buildColumns(
  visibleColumns: readonly ChartsTableColumnId[],
  // eslint-disable-next-line no-unused-vars
  onEditWorkItem?: (item: ChartDrilldownTableItem) => void
): ColumnDef<ChartDrilldownTableItem>[] {
  const allowed = new Set(
    visibleColumns.length > 0
      ? visibleColumns
      : DEFAULT_CHARTS_VISIBLE_TABLE_COLUMNS
  );
  const columns: ColumnDef<ChartDrilldownTableItem>[] = [];

  if (allowed.has('task')) {
    columns.push({
      accessorKey: 'title',
      header: CHARTS_TABLE_COLUMN_LABELS.task,
      cell: ({ row }) => (
        <TruncatedText className="max-w-56 text-sm font-medium">
          {row.original.title}
        </TruncatedText>
      ),
    });
  }
  if (allowed.has('owner')) {
    columns.push({
      id: 'owner',
      header: CHARTS_TABLE_COLUMN_LABELS.owner,
      cell: ({ row }) => {
        const { assigneeName, assigneeAvatar } = row.original;
        if (!assigneeName) {
          return (
            <span className="text-muted-foreground text-sm">Unassigned</span>
          );
        }
        return (
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar
              name={assigneeName}
              imageUrl={assigneeAvatar}
              className="size-6"
            />
            <TruncatedText className="max-w-28 text-sm">
              {assigneeName}
            </TruncatedText>
          </div>
        );
      },
    });
  }
  if (allowed.has('status')) {
    columns.push({
      accessorKey: 'status',
      header: CHARTS_TABLE_COLUMN_LABELS.status,
      cell: ({ row }) => <WorkItemStatusBadge status={row.original.status} />,
    });
  }
  if (allowed.has('type')) {
    columns.push({
      accessorKey: 'type',
      header: CHARTS_TABLE_COLUMN_LABELS.type,
      cell: ({ row }) => <WorkItemTypeBadge type={row.original.type} />,
    });
  }
  if (allowed.has('priority')) {
    columns.push({
      accessorKey: 'priority',
      header: CHARTS_TABLE_COLUMN_LABELS.priority,
      cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
    });
  }
  if (allowed.has('project')) {
    columns.push({
      id: 'project',
      header: CHARTS_TABLE_COLUMN_LABELS.project,
      cell: ({ row }) => (
        <TruncatedText className="max-w-40 text-sm">
          {row.original.projectName ?? '—'}
        </TruncatedText>
      ),
    });
  }
  if (allowed.has('sprint')) {
    columns.push({
      id: 'sprint',
      header: CHARTS_TABLE_COLUMN_LABELS.sprint,
      cell: ({ row }) => (
        <TruncatedText className="text-muted-foreground max-w-36 text-sm">
          {row.original.sprintName ?? 'No sprint'}
        </TruncatedText>
      ),
    });
  }
  if (allowed.has('actions')) {
    columns.push({
      id: 'actions',
      header: CHARTS_TABLE_COLUMN_LABELS.actions,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                aria-label={`Actions for ${row.original.title}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild className="cursor-pointer gap-2">
                <Link href={`/work-items/${row.original.id}`}>
                  <ExternalLink className="size-3.5" />
                  Open
                </Link>
              </DropdownMenuItem>
              {onEditWorkItem && row.original.workItem ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onClick={() => onEditWorkItem(row.original)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    });
  }
  return columns;
}

export function ChartsStatusGroupedTable({
  workItems,
  focusedStatus = null,
  loading = false,
  emptyMessage = 'No work items match the current filters.',
  className,
  visibleColumns = DEFAULT_CHARTS_VISIBLE_TABLE_COLUMNS,
  onEditWorkItem,
}: Readonly<ChartsStatusGroupedTableProps>) {
  const groups = useMemo(
    () => buildChartStatusGroups(workItems, focusedStatus),
    [focusedStatus, workItems]
  );

  const columns = useMemo(
    () => buildColumns(visibleColumns, onEditWorkItem),
    [onEditWorkItem, visibleColumns]
  );

  if (loading) {
    return (
      <output
        className={cn(
          'text-muted-foreground flex min-h-0 flex-1 items-center justify-center',
          className
        )}
        aria-label="Loading work items"
      >
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </output>
    );
  }

  if (groups.length === 0) {
    if (emptyMessage == null || emptyMessage === '') {
      return (
        <div className={cn('flex min-h-0 flex-1', className)} aria-hidden />
      );
    }
    return <ChartsEmptyState message={emptyMessage} className={className} />;
  }

  /**
   * Remount when the visible status set changes (e.g. search) so matching
   * groups open expanded — same idea as Monday hiding empty groups.
   */
  const groupsSignature = groups.map((group) => group.status).join('|');

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-0.5',
        className
      )}
    >
      {groups.map((group) => {
        const meta = STATUS_META[group.status];
        const label = meta?.label ?? group.status;
        return (
          <GroupedItemsSection
            key={`${groupsSignature}:${group.status}`}
            label={label}
            labelClassName={meta?.textClass}
            itemCount={group.items.length}
            defaultOpen
          >
            <GroupedItemsPaginatedTable
              data={group.items}
              columns={columns}
              getRowId={(row) => row.id}
              emptyState="No work items in this status"
              itemLabel="tasks"
              pageSize={10}
              rowClassName="hover:bg-muted/40"
            />
          </GroupedItemsSection>
        );
      })}
    </div>
  );
}
