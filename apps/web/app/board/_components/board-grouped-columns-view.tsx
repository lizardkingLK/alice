'use client';

import { useMemo, type DragEvent } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { GripVertical } from '@repo/ui/lib/icons';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import type { BoardColumn } from '@repo/types/api/v1';
import { PriorityBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-priority';
import { WorkItemStatusBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-status';
import { WorkItemTypeBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-type';
import { STATUS_META } from '@/app/work-items/_helpers/work-item-status';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { GroupedItemsPaginatedTable } from '@/components/grouped-items/grouped-items-paginated-table';
import { GroupedItemsSection } from '@/components/grouped-items/grouped-items-section';
import { UserAvatar } from '@/components/user-avatar';

type BoardGroupedColumnsViewProps = {
  readonly boardColumns: readonly BoardColumn[];
  readonly columnItemsMap: ReadonlyMap<string, DbWorkItem[]>;
  readonly activeDropCol: string | null;
  readonly draggedTaskId: string | null;
  readonly pendingStatusIds: ReadonlySet<string>;
  // eslint-disable-next-line no-unused-vars
  readonly onSelectItem: (item: DbWorkItem) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onCreateInColumn: (column: BoardColumn) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onItemDragStart: (event: DragEvent, id: string) => void;
  readonly onItemDragEnd: () => void;
  // eslint-disable-next-line no-unused-vars
  readonly onColumnDragOver: (event: DragEvent, columnId: string) => void;
  readonly onColumnDragLeave: () => void;
  // eslint-disable-next-line no-unused-vars
  readonly onColumnDrop: (event: DragEvent, column: BoardColumn) => void;
  readonly className?: string;
};

function buildColumns(
  // eslint-disable-next-line no-unused-vars
  onSelect: (item: DbWorkItem) => void
): ColumnDef<DbWorkItem>[] {
  return [
    {
      id: 'drag',
      header: '',
      cell: () => (
        <span className="text-muted-foreground/50 inline-flex">
          <GripVertical className="size-4" aria-hidden />
        </span>
      ),
      size: 32,
    },
    {
      accessorKey: 'title',
      header: 'Task',
      cell: ({ row }) => (
        <button
          type="button"
          className="hover:text-primary max-w-56 cursor-pointer text-left text-sm font-medium"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(row.original);
          }}
        >
          <TruncatedText>{row.original.title}</TruncatedText>
        </button>
      ),
    },
    {
      id: 'owner',
      header: 'Owner',
      cell: ({ row }) => {
        const assignee = row.original.assignee;
        if (!assignee?.name?.trim()) {
          return (
            <span className="text-muted-foreground text-sm">Unassigned</span>
          );
        }
        return (
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar
              name={assignee.name}
              imageUrl={assignee.profile_picture}
              className="size-6"
            />
            <TruncatedText className="max-w-28 text-sm">
              {assignee.name}
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

export function BoardGroupedColumnsView({
  boardColumns,
  columnItemsMap,
  activeDropCol,
  draggedTaskId,
  pendingStatusIds,
  onSelectItem,
  onCreateInColumn,
  onItemDragStart,
  onItemDragEnd,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
  className,
}: Readonly<BoardGroupedColumnsViewProps>) {
  const columns = useMemo(() => buildColumns(onSelectItem), [onSelectItem]);

  const getRowProps = (row: Row<DbWorkItem>) => {
    const id = row.original.id;
    const isPending = pendingStatusIds.has(id) || draggedTaskId === id;
    return {
      draggable: !pendingStatusIds.has(id),
      className: cn(
        'hover:bg-muted/40 cursor-grab active:cursor-grabbing',
        isPending && 'opacity-40'
      ),
      onDragStart: (event: DragEvent<HTMLTableRowElement>) => {
        if (pendingStatusIds.has(id)) {
          event.preventDefault();
          return;
        }
        onItemDragStart(event, id);
      },
      onDragEnd: onItemDragEnd,
    };
  };

  if (boardColumns.length === 0) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex min-h-0 flex-1 items-center justify-center text-sm',
          className
        )}
      >
        No board columns configured.
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
      {boardColumns.map((column) => {
        const items = columnItemsMap.get(column.id) ?? [];
        const meta = STATUS_META[column.status];
        return (
          <GroupedItemsSection
            key={column.id}
            label={column.name}
            labelClassName={meta?.textClass}
            itemCount={items.length}
            defaultOpen
            addAriaLabel={`Create work item in ${column.name}`}
            onAdd={() => onCreateInColumn(column)}
            isDragOver={activeDropCol === column.id}
            onDragOver={(event) => onColumnDragOver(event, column.id)}
            onDragLeave={onColumnDragLeave}
            onDrop={(event) => onColumnDrop(event, column)}
          >
            <GroupedItemsPaginatedTable
              data={items}
              columns={columns}
              getRowId={(row) => row.id}
              emptyState="No work items in this column"
              itemLabel="work items"
              getRowProps={getRowProps}
            />
          </GroupedItemsSection>
        );
      })}
    </div>
  );
}
