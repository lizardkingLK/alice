'use client';

import { useEffect, useMemo, useState, type HTMLAttributes } from 'react';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Row,
} from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { Pagination } from '@/components/pagination';

const DEFAULT_PAGE_SIZE = 10;

type GroupedItemsPaginatedTableProps<TData> = {
  readonly data: readonly TData[];
  readonly columns: ColumnDef<TData, unknown>[];
  // eslint-disable-next-line no-unused-vars -- row id
  readonly getRowId: (row: TData) => string;
  readonly emptyState: string;
  readonly itemLabel?: string;
  readonly pageSize?: number;
  readonly rowClassName?: string;
  readonly getRowProps?: (
    // eslint-disable-next-line no-unused-vars -- row props
    row: Row<TData>
  ) => HTMLAttributes<HTMLTableRowElement>;
};

/**
 * Paginated DataTable used inside a {@link GroupedItemsSection}.
 */
export function GroupedItemsPaginatedTable<TData>({
  data,
  columns,
  getRowId,
  emptyState,
  itemLabel = 'items',
  pageSize = DEFAULT_PAGE_SIZE,
  rowClassName,
  getRowProps,
}: Readonly<GroupedItemsPaginatedTableProps<TData>>) {
  const rows = useMemo(() => [...data], [data]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [data]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => getRowId(row),
  });

  const page = pagination.pageIndex + 1;
  const limit = pagination.pageSize;
  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <DataTable
        table={table}
        columnCount={columns.length}
        emptyState={emptyState}
        rowClassName={rowClassName}
        getRowProps={getRowProps}
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
            label={itemLabel}
          />
        </div>
      ) : null}
    </div>
  );
}
