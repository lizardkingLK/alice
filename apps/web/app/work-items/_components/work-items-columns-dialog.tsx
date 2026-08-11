'use client';

import { useMemo } from 'react';
import type { VisibilityState } from '@tanstack/react-table';
import { TableColumnsDialog } from '@/components/table-columns/table-columns-dialog';
import {
  DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY,
  WORK_ITEM_TABLE_COLUMN_LABELS,
  hasCustomWorkItemTableColumnVisibility,
  isRequiredWorkItemTableColumnId,
  listWorkItemTableColumnOptions,
  normalizeWorkItemTableColumnVisibility,
  type WorkItemTableColumnId,
} from '@/app/work-items/_helpers/work-item-table-columns-storage';

export function WorkItemsColumnsDialog({
  visibility,
  isProjectLocked,
  disabled = false,
  onApply,
}: Readonly<{
  visibility: VisibilityState;
  isProjectLocked: boolean;
  disabled?: boolean;
  // eslint-disable-next-line no-unused-vars
  onApply: (visibility: VisibilityState) => void;
}>) {
  const columnIds = useMemo(
    () => listWorkItemTableColumnOptions({ isProjectLocked }),
    [isProjectLocked]
  );

  return (
    <TableColumnsDialog
      visibility={visibility}
      columnIds={columnIds}
      labels={WORK_ITEM_TABLE_COLUMN_LABELS}
      defaultVisibility={DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY}
      inputIdPrefix="work-item-column"
      disabled={disabled}
      blockOpenWhenDisabled
      highlightTriggerWhenOpen
      title="Customize columns"
      description="Choose which columns appear on the work items table."
      contentClassName="sm:max-w-md"
      listClassName="max-h-86 space-y-0.5 overflow-y-auto py-1"
      triggerClassName="h-9 cursor-pointer gap-1.5 px-3"
      triggerAriaLabel={(applied) =>
        applied ? 'Columns applied — customize columns' : 'Customize columns'
      }
      normalize={normalizeWorkItemTableColumnVisibility}
      hasCustom={(next) =>
        hasCustomWorkItemTableColumnVisibility(next, { isProjectLocked })
      }
      isRequired={(id) =>
        isRequiredWorkItemTableColumnId(id as WorkItemTableColumnId)
      }
      onApply={onApply}
    />
  );
}
