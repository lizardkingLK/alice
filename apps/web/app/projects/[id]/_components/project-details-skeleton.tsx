import { Card, CardContent, CardHeader } from '@repo/ui/components/ui/card';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { skeletonKeys } from '@/components/skeleton-keys';

export function ProjectDetailsSkeleton() {
  return (
    <div
      className="w-full space-y-6"
      aria-busy="true"
      aria-label="Loading project details"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="flex items-center gap-4 border-b pb-0">
        {skeletonKeys('tab', 3).map((key) => (
          <Skeleton key={key} className="mb-3 h-5 w-24" />
        ))}
      </div>

      <Card className="border-border bg-card/50">
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {skeletonKeys('field', 6).map((key) => (
            <div key={key} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
