'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { BOARD_WORK_ITEM_STATUSES, type WorkItemStatus } from '@repo/types';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import type { ChartDrilldownTableItem } from '@/app/charts/_helpers/charts-analytics.ui';
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
  readonly emptyMessage?: string;
  readonly className?: string;
};

function buildColumns(): ColumnDef<ChartDrilldownTableItem>[] {
  return [
    {
      accessorKey: 'title',
      header: 'Task',
      cell: ({ row }) => (
        <TruncatedText className="max-w-56 text-sm font-medium">
          {row.original.title}
        </TruncatedText>
      ),
    },
    {
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
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <WorkItemStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => <WorkItemTypeBadge type={row.original.type} />,
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
    },
  ];
}

export function ChartsStatusGroupedTable({
  workItems,
  focusedStatus = null,
  loading = false,
  emptyMessage = 'No work items match the current filters.',
  className,
}: Readonly<ChartsStatusGroupedTableProps>) {
  const groups = useMemo(() => {
    const statuses = focusedStatus
      ? BOARD_WORK_ITEM_STATUSES.filter((status) => status === focusedStatus)
      : BOARD_WORK_ITEM_STATUSES;

    return statuses
      .map((status) => ({
        status,
        items: workItems.filter((item) => item.status === status),
      }))
      .filter((group) => focusedStatus || group.items.length > 0);
  }, [focusedStatus, workItems]);

  const columns = useMemo(() => buildColumns(), []);

  if (loading) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex min-h-0 flex-1 items-center justify-center text-sm',
          className
        )}
      >
        Loading work items…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex min-h-0 flex-1 items-center justify-center text-sm',
          className
        )}
      >
        {emptyMessage}
      </div>
    );
  }

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
            key={group.status}
            label={label}
            labelClassName={meta?.textClass}
            itemCount={group.items.length}
            defaultOpen={Boolean(focusedStatus) || group.items.length > 0}
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
