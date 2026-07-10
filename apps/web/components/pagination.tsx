/* eslint-disable no-unused-vars */
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly onPageChange: (_p: number) => void;
  readonly onLimitChange: (_l: number) => void;
  readonly label: string;
}

export function Pagination({
  totalCount,
  page,
  limit,
  totalPages,
  onPageChange,
  onLimitChange,
  label,
}: PaginationProps) {
  return (
    <div className="border-t border-border mt-6 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="text-muted-foreground text-xs">
        Showing{' '}
        <span className="font-semibold text-foreground">
          {totalCount === 0 ? 0 : (page - 1) * limit + 1}
        </span>{' '}
        to{' '}
        <span className="font-semibold text-foreground">
          {Math.min(page * limit, totalCount)}
        </span>{' '}
        of{' '}
        <span className="font-semibold text-foreground">{totalCount}</span>{' '}
        {label}
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        {/* Page Limit Selector */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Rows per page:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="border-input bg-background/50 hover:bg-accent text-foreground rounded border px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            {[5, 10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Page Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="border-input bg-background/50 hover:bg-accent disabled:opacity-50 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border text-xs font-semibold shadow-sm transition-all focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Dynamic Page Numbers */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              // Show first, last, and pages around current page
              return p === 1 || p === totalPages || Math.abs(p - page) <= 1;
            })
            .map((p, idx, arr) => {
              const prevPage = arr[idx - 1];
              const showEllipsisBefore = idx > 0 && prevPage !== undefined && p - prevPage > 1;
              return (
                <div key={p} className="flex items-center gap-1">
                  {showEllipsisBefore && (
                    <span className="text-muted-foreground px-1 text-xs">...</span>
                  )}
                  <button
                    onClick={() => onPageChange(p)}
                    className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border text-xs font-semibold shadow-sm transition-all focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none ${
                      page === p
                        ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/95'
                        : 'border-input bg-background/50 hover:bg-accent text-foreground'
                    }`}
                  >
                    {p}
                  </button>
                </div>
              );
            })}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="border-input bg-background/50 hover:bg-accent disabled:opacity-50 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border text-xs font-semibold shadow-sm transition-all focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
