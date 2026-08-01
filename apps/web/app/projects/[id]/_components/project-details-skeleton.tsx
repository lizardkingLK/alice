import { Card, CardContent, CardHeader } from '@repo/ui/components/ui/card';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { skeletonKeys } from '@/app/_shared/utility';

export function ProjectDetailsSkeleton() {
  return (
    <div
      className="w-full space-y-6"
      aria-busy="true"
      aria-label="Loading project details"
    >
      <div className="border-primary/15 from-primary/5 space-y-4 rounded-2xl border bg-linear-to-r via-transparent to-transparent px-6 py-4 md:px-8 md:py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="flex items-center gap-4 border-b pb-0">
        {skeletonKeys('tab', 4).map((key) => (
          <Skeleton key={key} className="mb-3 h-5 w-28" />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skeletonKeys('metric', 3).map((key) => (
          <Card
            key={key}
            className="border-border/60 bg-card/50 backdrop-blur-sm"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-12" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-border/60 bg-card/50 md:col-span-2">
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {skeletonKeys('field', 4).map((key) => (
              <div key={key} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/50 h-fit">
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-14 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
