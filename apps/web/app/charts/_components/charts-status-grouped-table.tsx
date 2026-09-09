'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from '@tanstack/react-table';
import { BOARD_WORK_ITEM_STATUSES, type WorkItemStatus } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { ChevronDown, ChevronRight, Plus } from '@repo/ui/lib/icons';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import {
  CHARTS_SAMPLE_MEMBERS,
  type ChartsSampleWorkItem,
} from '@/app/charts/_components/charts-sample.data';
import {
  applyChartsSampleLocalMutate,
  chartsSampleMembersForForm,
  chartsSampleProjectsForForm,
  chartsSampleToDbWorkItem,
} from '@/app/charts/_components/charts-work-item-mock';
import { WorkItemStatusBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-status';
import { WorkItemTypeBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-type';
import { PriorityBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-priority';
import { WorkItemFormDialog } from '@/app/work-items/_components/work-item-form/work-item-form-dialog';
import { STATUS_META } from '@/app/work-items/_helpers/work-item-status';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { DataTable } from '@/components/data-table';
import { Pagination } from '@/components/pagination';
import { RegistryRowActions } from '@/components/registry-row-actions';
import { UserAvatar } from '@/components/user-avatar';

const DEFAULT_PAGE_SIZE = 10;
const DIALOG_CLOSE_MS = 200;

const CHARTS_FORM_PROJECTS = chartsSampleProjectsForForm();
const CHARTS_FORM_MEMBERS = chartsSampleMembersForForm();

type ChartsStatusGroupedTableProps = {
  /** Rows shown in the grouped table (may be filtered). */
  readonly workItems: readonly ChartsSampleWorkItem[];
  /**
   * Full session list used for create/edit merges. Defaults to `workItems`
   * when omitted.
   */
  readonly sourceWorkItems?: readonly ChartsSampleWorkItem[];
  /** Session-only mock mutations (reset on full page reload). */
  // eslint-disable-next-line no-unused-vars
  readonly onWorkItemsChange?: (next: ChartsSampleWorkItem[]) => void;
  /** When set, only this status group is shown (pie-slice filter). */
  readonly focusedStatus?: WorkItemStatus | null;
  readonly className?: string;
};

function buildColumns(
  // eslint-disable-next-line no-unused-vars
  onEdit: (item: ChartsSampleWorkItem) => void
): ColumnDef<ChartsSampleWorkItem>[] {
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
        const member = CHARTS_SAMPLE_MEMBERS.find(
          (entry) => entry.id === row.original.assigneeId
        );
        if (!member) {
          return (
            <span className="text-muted-foreground text-sm">Unassigned</span>
          );
        }
        return (
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar
              name={member.name}
              imageUrl={member.profilePicture}
              className="size-6"
            />
            <TruncatedText className="max-w-28 text-sm">
              {member.name}
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
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RegistryRowActions
          isPending={false}
          isManagerOrAdmin
          isAdmin={false}
          isActiveView
          canEdit
          canArchive={false}
          onEdit={() => onEdit(row.original)}
          onArchive={() => undefined}
          onRestore={() => undefined}
          onPurge={() => undefined}
        />
      ),
    },
  ];
}

function StatusGroupTable({
  items,
  onEdit,
}: Readonly<{
  items: readonly ChartsSampleWorkItem[];
  // eslint-disable-next-line no-unused-vars
  onEdit: (item: ChartsSampleWorkItem) => void;
}>) {
  const data = useMemo(() => [...items], [items]);
  const columns = useMemo(() => buildColumns(onEdit), [onEdit]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [items]);

  const table = useReactTable({
    data,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
  });

  const page = pagination.pageIndex + 1;
  const limit = pagination.pageSize;
  const totalCount = data.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <DataTable
        table={table}
        columnCount={columns.length}
        emptyState="No sample tasks in this status"
        rowClassName="hover:bg-muted/40"
      />
      {totalCount > 0 ? (
        <div className="[&>div]:mt-2 [&>div]:border-t-0 [&>div]:pt-2">
          <Pagination
            totalCount={totalCount}
            page={page}
            limit={limit}
            totalPages={totalPages}
            onPageChange={(nextPage) => {
              setPagination((prev) => ({
                ...prev,
                pageIndex: Math.max(0, nextPage - 1),
              }));
            }}
            onLimitChange={(nextLimit) => {
              setPagination({ pageIndex: 0, pageSize: nextLimit });
            }}
            label="tasks"
          />
        </div>
      ) : null}
    </div>
  );
}

function StatusGroupSection({
  status,
  items,
  defaultOpen,
  onCreate,
  onEdit,
}: Readonly<{
  status: WorkItemStatus;
  items: readonly ChartsSampleWorkItem[];
  defaultOpen: boolean;
  // eslint-disable-next-line no-unused-vars
  onCreate: (status: WorkItemStatus) => void;
  // eslint-disable-next-line no-unused-vars
  onEdit: (item: ChartsSampleWorkItem) => void;
}>) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = STATUS_META[status];
  const label = meta?.label ?? status;
  const countLabel = items.length === 1 ? '1 item' : `${items.length} items`;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="min-w-0">
      <div className="flex items-center gap-1">
        <CollapsibleTrigger
          type="button"
          aria-label={`${label}, ${countLabel}`}
          className={cn(
            'group hover:bg-muted/50 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm font-semibold tracking-tight',
            meta?.textClass
          )}
        >
          {open ? (
            <ChevronDown className="size-4 shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="size-4 shrink-0" aria-hidden />
          )}
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="min-w-0">{label}</span>
            <span
              className="text-muted-foreground text-xs font-normal opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            >
              {countLabel}
            </span>
          </span>
        </CollapsibleTrigger>

        <Tooltip delayDuration={400}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Add task in ${label}`}
              className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              onClick={(event) => {
                event.stopPropagation();
                onCreate(status);
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <Plus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Add task</TooltipContent>
        </Tooltip>
      </div>
      <CollapsibleContent className="pt-1 pb-3">
        <StatusGroupTable items={items} onEdit={onEdit} />
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ChartsStatusGroupedTable({
  workItems,
  sourceWorkItems,
  onWorkItemsChange,
  focusedStatus = null,
  className,
}: Readonly<ChartsStatusGroupedTableProps>) {
  const mutationSource = sourceWorkItems ?? workItems;
  const [formOpen, setFormOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<DbWorkItem | null>(null);
  const [createStatus, setCreateStatus] = useState<WorkItemStatus | null>(null);

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

  const openCreate = (status: WorkItemStatus) => {
    setItemToEdit(null);
    setCreateStatus(status);
    setFormOpen(true);
  };

  const openEdit = (item: ChartsSampleWorkItem) => {
    setCreateStatus(null);
    setItemToEdit(chartsSampleToDbWorkItem(item));
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      window.setTimeout(() => {
        setItemToEdit(null);
        setCreateStatus(null);
      }, DIALOG_CLOSE_MS);
    }
  };

  if (groups.length === 0) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex min-h-0 flex-1 items-center justify-center text-sm',
          className
        )}
      >
        No sample tasks match the current filters.
      </div>
    );
  }

  const createLabel = createStatus
    ? (STATUS_META[createStatus]?.label ?? createStatus)
    : '';

  return (
    <>
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-0.5',
          className
        )}
      >
        {groups.map((group) => (
          <StatusGroupSection
            key={group.status}
            status={group.status}
            items={group.items}
            defaultOpen
            onCreate={openCreate}
            onEdit={openEdit}
          />
        ))}
      </div>

      <WorkItemFormDialog
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        title={itemToEdit ? 'Edit Work Item' : 'Create Work Item'}
        description={
          itemToEdit
            ? 'Update this sample work item (session only — resets on reload).'
            : `Create a sample work item in ${createLabel} (session only — resets on reload).`
        }
        projects={CHARTS_FORM_PROJECTS}
        projectMembers={CHARTS_FORM_MEMBERS}
        itemToEdit={itemToEdit}
        lockStatus={Boolean(createStatus) && !itemToEdit}
        defaultStatus={createStatus ?? undefined}
        lockParent
        preferProvidedMembers
        localMutate={async (args) => {
          const result = applyChartsSampleLocalMutate(args, mutationSource);
          onWorkItemsChange?.(result.nextItems);
          return result.workItem;
        }}
        onClose={() => handleFormOpenChange(false)}
        onSuccess={() => {
          handleFormOpenChange(false);
        }}
      />
    </>
  );
}
