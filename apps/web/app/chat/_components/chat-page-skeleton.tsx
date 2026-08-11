import { Loader2 } from '@repo/ui/lib/icons';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { Separator } from '@repo/ui/components/ui/separator';

export function ChatPageSkeleton() {
  return (
    <div className="bg-background flex h-full min-h-0 flex-1 overflow-hidden">
      <aside
        className="border-border bg-muted/20 flex w-64 shrink-0 flex-col border-r"
        aria-hidden="true"
      >
        <div className="border-border flex h-14 shrink-0 items-center border-b px-3">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="space-y-2 p-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </aside>

      <div className="bg-background flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-border flex h-14 items-center border-b px-4">
          <Skeleton className="h-5 w-24 rounded-md" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-9 w-[150px] rounded-md" />
            <Skeleton className="bg-primary/10 h-9 w-28 rounded-md" />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center p-6">
            <div className="bg-primary/5 text-primary flex size-16 items-center justify-center rounded-full">
              <Loader2 className="size-6 animate-spin" />
            </div>
            <div className="mt-6 flex w-full max-w-md flex-col items-center space-y-3 text-center">
              <Skeleton className="h-6 w-64 rounded-md" />
              <Skeleton className="h-4 w-80 rounded-md" />
              <Skeleton className="h-4 w-72 rounded-md" />
            </div>

            <div className="mt-5 grid w-full max-w-md grid-cols-1 gap-3">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </div>
        </div>

        <Separator />
        <div className="bg-muted/20 shrink-0 p-3 sm:p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2 sm:gap-3">
            <Skeleton className="h-10 flex-1 rounded-md" />
            <Skeleton className="bg-primary/10 h-10 w-10 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
