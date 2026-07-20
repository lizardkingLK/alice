/* eslint-disable no-unused-vars */
'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@repo/ui/components/ui/select';
import { ChevronLeft, ChevronRight } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

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
    <div className="border-border mt-6 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted-foreground text-xs">
        Showing{' '}
        <span className="text-foreground font-semibold">
          {totalCount === 0 ? 0 : (page - 1) * limit + 1}
        </span>{' '}
        to{' '}
        <span className="text-foreground font-semibold">
          {Math.min(page * limit, totalCount)}
        </span>{' '}
        of <span className="text-foreground font-semibold">{totalCount}</span>{' '}
        {label}
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        {/* Page Limit Selector */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Rows per page:</span>
          <Select
            value={String(limit)}
            onValueChange={(val) => onLimitChange(Number(val))}
          >
            <SelectTrigger className="bg-background/50 hover:bg-accent h-7 w-17.5 text-xs font-medium">
              <SelectValue placeholder={String(limit)} />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="bg-background/50 h-8 w-8 text-xs font-semibold shadow-sm transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Dynamic Page Numbers */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              // Show first, last, and pages around current page
              return p === 1 || p === totalPages || Math.abs(p - page) <= 1;
            })
            .map((p, idx, arr) => {
              const prevPage = arr[idx - 1];
              const showEllipsisBefore =
                idx > 0 && prevPage !== undefined && p - prevPage > 1;
              return (
                <div key={p} className="flex items-center gap-1">
                  {showEllipsisBefore && (
                    <span className="text-muted-foreground px-1 text-xs">
                      ...
                    </span>
                  )}
                  <Button
                    variant={page === p ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => onPageChange(p)}
                    className={cn(
                      'h-8 w-8 text-xs font-semibold shadow-sm transition-all',
                      page === p
                        ? 'bg-primary text-primary-foreground hover:bg-primary/95'
                        : 'bg-background/50 hover:bg-accent text-foreground'
                    )}
                  >
                    {p}
                  </Button>
                </div>
              );
            })}

          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="bg-background/50 h-8 w-8 text-xs font-semibold shadow-sm transition-all"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
