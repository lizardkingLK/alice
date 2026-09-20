'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { BOARD_WORK_ITEM_STATUSES, type WorkItemStatus } from '@repo/types';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { Loader2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { ChartsTableColumnId } from '@/app/charts/_components/charts.types';
import type { ChartDrilldownTableItem } from '@/app/charts/_helpers/charts-analytics.ui';
import { ChartsEmptyState } from '@/app/charts/_components/charts-empty-state';
import { WorkItemStatusBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-status';
import { WorkItemTypeBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-type';
import { PriorityBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-priority';
import { STATUS_META } from '@/app/work-items/_helpers/work-item-status';
import { GroupedItemsPaginatedTable } from '@/components/grouped-items/grouped-items-paginated-table';
import { GroupedItemsSection } from '@/components/grouped-items/grouped-items-section';
import { UserAvatar } from '@/components/user-avatar';

const ALL_TABLE_COLUMNS: readonly ChartsTableColumnId[] = [
  'task',
  'owner',
  'status',
  'type',
  'priority',
] as const;

type ChartsStatusGroupedTableProps = {
  readonly workItems: readonly ChartDrilldownTableItem[];
  /** When set, only this status group is shown (pie-slice filter). */
  readonly focusedStatus?: WorkItemStatus | null;
  readonly loading?: boolean;
  /** When `undefined` / empty, hide the empty state (e.g. dialog closing). */
  readonly emptyMessage?: string;
  readonly className?: string;
  readonly visibleColumns?: readonly ChartsTableColumnId[];
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
  visibleColumns: readonly ChartsTableColumnId[]
): ColumnDef<ChartDrilldownTableItem>[] {
  const allowed = new Set(
    visibleColumns.length > 0 ? visibleColumns : ALL_TABLE_COLUMNS
  );
  const columns: ColumnDef<ChartDrilldownTableItem>[] = [];

  if (allowed.has('task')) {
    columns.push({
      accessorKey: 'title',
      header: 'Task',
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
      header: 'Owner',
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
      header: 'Status',
      cell: ({ row }) => <WorkItemStatusBadge status={row.original.status} />,
    });
  }
  if (allowed.has('type')) {
    columns.push({
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => <WorkItemTypeBadge type={row.original.type} />,
    });
  }
  if (allowed.has('priority')) {
    columns.push({
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
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
  visibleColumns = ALL_TABLE_COLUMNS,
}: Readonly<ChartsStatusGroupedTableProps>) {
  const groups = useMemo(
    () => buildChartStatusGroups(workItems, focusedStatus),
    [focusedStatus, workItems]
  );

  const columns = useMemo(() => buildColumns(visibleColumns), [visibleColumns]);

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
