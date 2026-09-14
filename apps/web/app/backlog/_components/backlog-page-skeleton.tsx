import { Card } from '@repo/ui/components/ui/card';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { skeletonKeys } from '@/app/_shared/utility';

function SprintColumnSkeleton({ id }: Readonly<{ id: string }>) {
  const itemKeys = skeletonKeys(`${id}-item`, 3);

  return (
    <Card className="border-border/70 overflow-hidden">
      <div className="border-border/50 flex items-center gap-3 border-b px-4 py-3">
        <Skeleton className="size-8 shrink-0 rounded-md" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2 p-3">
        {itemKeys.map((key) => (
          <Skeleton key={key} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </Card>
  );
}

export function BacklogPageSkeleton() {
  const sprintKeys = skeletonKeys('sprint', 2);

  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading backlog content"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-full max-w-xs sm:w-64" />
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <Skeleton className="size-8 shrink-0 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <Skeleton className="h-9 w-44 rounded-lg" />
          <Skeleton className="size-8 shrink-0 rounded-md" />
        </div>
      </div>

      <div className="space-y-4">
        {sprintKeys.map((key) => (
          <SprintColumnSkeleton key={key} id={key} />
        ))}
        <Card className="border-border/70 overflow-hidden">
          <div className="border-border/50 flex items-center justify-between border-b px-4 py-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2 p-3">
            {skeletonKeys('backlog-item', 4).map((key) => (
              <Skeleton key={key} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
