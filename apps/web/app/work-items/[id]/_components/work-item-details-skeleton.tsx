import { Card, CardContent } from '@repo/ui/components/ui/card';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { skeletonKeys } from '@/app/_shared/utility';

export function WorkItemDetailsSkeleton() {
  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      aria-busy="true"
      aria-label="Loading work item details"
    >
      <div className="min-w-0 space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        </div>

        <Card className="border-border shadow-none">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-28" />
            {skeletonKeys('desc', 5).map((key) => (
              <Skeleton key={key} className="h-4 w-full" />
            ))}
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardContent className="space-y-4 p-4">
            <Skeleton className="h-5 w-32" />
            {skeletonKeys('comment', 3).map((key) => (
              <div key={key} className="flex items-start gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-16 w-full rounded-md" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card className="border-border shadow-none">
          <CardContent className="space-y-4 p-4">
            {skeletonKeys('sidebar', 6).map((key) => (
              <div key={key} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
