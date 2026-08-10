'use client';

import type { VisibilityState } from '@tanstack/react-table';
import { TableColumnsDialog } from '@/components/table-columns/table-columns-dialog';
import {
  DEFAULT_VIEWS_TABLE_COLUMN_VISIBILITY,
  VIEWS_TABLE_COLUMN_LABELS,
  hasCustomViewsTableColumnVisibility,
  isRequiredViewsTableColumnId,
  listViewsTableColumnOptions,
  normalizeViewsTableColumnVisibility,
} from '@/app/views/_helpers/views-table-columns-storage';

export function ViewsColumnsDialog({
  visibility,
  disabled = false,
  onApply,
}: Readonly<{
  visibility: VisibilityState;
  disabled?: boolean;
  // eslint-disable-next-line no-unused-vars
  onApply: (visibility: VisibilityState) => void;
}>) {
  return (
    <TableColumnsDialog
      visibility={visibility}
      columnIds={listViewsTableColumnOptions()}
      labels={VIEWS_TABLE_COLUMN_LABELS}
      defaultVisibility={DEFAULT_VIEWS_TABLE_COLUMN_VISIBILITY}
      inputIdPrefix="views-column"
      disabled={disabled}
      title="Columns"
      description="Choose which columns appear in the Views table."
      normalize={normalizeViewsTableColumnVisibility}
      hasCustom={hasCustomViewsTableColumnVisibility}
      isRequired={(id) =>
        isRequiredViewsTableColumnId(
          id as keyof typeof VIEWS_TABLE_COLUMN_LABELS
        )
      }
      onApply={onApply}
    />
  );
}
