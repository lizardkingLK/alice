import { Card, CardContent, CardHeader } from '@repo/ui/components/ui/card';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { cn } from '@repo/ui/lib/utils';
import { skeletonKeys } from '@/app/_shared/utility';

/** Pie + legend placeholder used while a chart widget loads. */
export function ChartsPieWidgetSkeleton({
  className,
}: Readonly<{ className?: string }>) {
  return (
    <div
      className={cn(
        'border-border bg-card flex h-full min-h-56 flex-col overflow-hidden rounded-xl border',
        className
      )}
      aria-hidden
    >
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <Skeleton className="size-4 shrink-0 rounded" />
        <Skeleton className="h-4 w-28 max-w-[40%]" />
        <div className="ml-auto flex gap-1">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-4 px-4 py-3">
        <Skeleton className="size-28 shrink-0 rounded-full sm:size-32" />
        <div className="flex w-28 flex-col gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}

/**
 * Full Charts workspace (board) loading UI — toolbar + pie-card grid.
 * Used by workspace route Suspense and client board hydrate.
 */
export function ChartsWorkspaceSkeleton({
  className,
}: Readonly<{ className?: string }>) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-1 flex-col gap-4',
        className
      )}
      aria-busy="true"
      aria-label="Loading charts workspace"
    >
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-56 max-w-full rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      <div className="border-border bg-card/50 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border backdrop-blur-md">
        <div className="shrink-0 space-y-2 p-4 pb-3">
          <Skeleton className="h-7 w-48 max-w-[60%]" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 pt-0 sm:grid-cols-2 xl:grid-cols-3">
          <ChartsPieWidgetSkeleton />
          <ChartsPieWidgetSkeleton />
          <ChartsPieWidgetSkeleton className="sm:col-span-2 xl:col-span-1" />
        </div>
      </div>
    </div>
  );
}

type ChartsRegistrySkeletonProps = {
  readonly className?: string;
  readonly rowCount?: number;
};

/**
 * Charts registry loading UI — search, tab pills, create CTA, table.
 * Mirrors `ChartsRegistry` layout for route loading and client hydrate.
 */
export function ChartsRegistrySkeleton({
  className,
  rowCount = 8,
}: Readonly<ChartsRegistrySkeletonProps>) {
  const columnCount = 4;
  const headerKeys = skeletonKeys('charts-reg-header', columnCount);
  const rowKeys = skeletonKeys('charts-reg-row', rowCount);

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-1 flex-col gap-4',
        className
      )}
      aria-busy="true"
      aria-label="Loading charts registry"
    >
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Skeleton className="h-9 w-56 max-w-full rounded-md" />
          <div className="border-border flex h-9 items-center gap-0.5 rounded-lg border p-0.5">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-9 w-40 self-start rounded-md" />
      </div>

      <Card className="border-border bg-card/50 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden backdrop-blur-md">
        <CardHeader className="shrink-0 space-y-2 pb-3">
          <Skeleton className="h-8 w-40 max-w-[50%]" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </CardHeader>
        <CardContent className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto pt-2 pb-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {headerKeys.map((key) => (
                    <TableHead key={key}>
                      <Skeleton className="h-4 w-20" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowKeys.map((rowKey) => (
                  <TableRow key={rowKey}>
                    {skeletonKeys(`charts-reg-cell-${rowKey}`, columnCount).map(
                      (cellKey, colIndex) => {
                        let cellClass = 'h-4 w-24';
                        if (colIndex === 0) {
                          cellClass = 'h-10 w-full max-w-48';
                        } else if (colIndex === columnCount - 1) {
                          cellClass = 'size-8 rounded-md';
                        }
                        return (
                          <TableCell key={cellKey}>
                            <Skeleton className={cellClass} />
                          </TableCell>
                        );
                      }
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-4 w-36" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
