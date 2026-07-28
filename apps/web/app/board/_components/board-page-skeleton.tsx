import { Card, CardContent, CardHeader } from '@repo/ui/components/ui/card';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { skeletonKeys } from '@/app/_shared/utility';

function BoardColumnSkeleton({ id }: Readonly<{ id: string }>) {
  return (
    <Card className="border-border/70 min-w-[16rem] flex-1 overflow-hidden border-t-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-8 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        {skeletonKeys(`${id}-card`, 3).map((key) => (
          <Skeleton key={key} className="h-24 w-full rounded-lg" />
        ))}
      </CardContent>
    </Card>
  );
}

export function BoardPageSkeleton() {
  const columnKeys = skeletonKeys('col', 5);

  return (
    <div
      className="space-y-4"
      aria-busy="true"
      aria-label="Loading board content"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {columnKeys.map((key) => (
          <BoardColumnSkeleton key={key} id={key} />
        ))}
      </div>
    </div>
  );
}
