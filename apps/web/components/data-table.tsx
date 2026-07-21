'use client';

import type { ReactNode } from 'react';
import { flexRender, type Table as TanstackTable } from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { cn } from '@repo/ui/lib/utils';

interface DataTableProps<TData> {
  readonly table: TanstackTable<TData>;
  readonly columnCount: number;
  readonly emptyState: ReactNode;
  readonly rowClassName?: string;
}

/**
 * Shared render layer for `@tanstack/react-table` tables. Keeps the header /
 * body / empty-state markup in one place so feature tables (work items, users,
 * ...) don't each re-implement the same boilerplate.
 */
export function DataTable<TData>({
  table,
  columnCount,
  emptyState,
  rowClassName,
}: Readonly<DataTableProps<TData>>) {
  const rows = table.getRowModel().rows;

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                className={cn(rowClassName)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="text-muted-foreground h-48 text-center"
              >
                {emptyState}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
