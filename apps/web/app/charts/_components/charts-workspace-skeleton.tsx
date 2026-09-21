import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { cn } from '@repo/ui/lib/utils';

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
 * Full Charts workspace loading UI — toolbar + pie-card grid.
 * Used by route `loading.tsx`, Suspense, and client board hydrate.
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
