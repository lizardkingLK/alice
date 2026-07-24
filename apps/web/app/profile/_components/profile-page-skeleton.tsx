import { Card, CardContent, CardHeader } from '@repo/ui/components/ui/card';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { skeletonKeys } from '@/components/skeleton-keys';

export function ProfilePageSkeleton() {
  return (
    <div
      className="bg-background min-h-full"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <Skeleton className="h-40 w-full rounded-none sm:h-48 md:h-56" />

      <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-10">
          <aside className="relative z-10 -mt-12 space-y-5 sm:-mt-14">
            <Skeleton className="border-background size-24 rounded-full border-4 sm:size-28" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-9 w-full" />
            <Card className="shadow-none">
              <CardHeader>
                <Skeleton className="h-5 w-16" />
              </CardHeader>
              <CardContent className="space-y-3">
                {skeletonKeys('about', 4).map((key) => (
                  <Skeleton key={key} className="h-4 w-full" />
                ))}
              </CardContent>
            </Card>
          </aside>

          <main className="min-w-0 space-y-6 pt-4 lg:pt-6">
            <Skeleton className="h-6 w-32" />
            <Card className="shadow-none">
              <CardContent className="divide-border space-y-0 divide-y p-0">
                {skeletonKeys('worked', 4).map((key) => (
                  <div key={key} className="flex items-start gap-3 px-4 py-3">
                    <Skeleton className="size-8 shrink-0 rounded-md" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}
