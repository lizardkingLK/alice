'use client';

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { BOARD_WORK_ITEM_STATUSES, type WorkItemStatus } from '@repo/types';
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
import { GroupedItemsPaginatedTable } from '@/components/grouped-items/grouped-items-paginated-table';
import { GroupedItemsSection } from '@/components/grouped-items/grouped-items-section';
import { RegistryRowActions } from '@/components/registry-row-actions';
import { UserAvatar } from '@/components/user-avatar';

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

  const columns = useMemo(() => buildColumns(openEdit), []);

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
        {groups.map((group) => {
          const meta = STATUS_META[group.status];
          const label = meta?.label ?? group.status;
          return (
            <GroupedItemsSection
              key={group.status}
              label={label}
              labelClassName={meta?.textClass}
              itemCount={group.items.length}
              defaultOpen
              addAriaLabel={`Add task in ${label}`}
              onAdd={() => openCreate(group.status)}
            >
              <GroupedItemsPaginatedTable
                data={group.items}
                columns={columns}
                getRowId={(row) => row.id}
                emptyState="No sample tasks in this status"
                itemLabel="tasks"
                rowClassName="hover:bg-muted/40"
              />
            </GroupedItemsSection>
          );
        })}
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
