import { Skeleton } from '@repo/ui/components/ui/skeleton';

/** Form-shaped skeleton for `/chat/agents/[agentId]` (not the chat thread shell). */
export function ChatAgentCustomizeSkeleton() {
  return (
    <div
      className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-busy="true"
      aria-label="Loading agent"
    >
      <header className="border-border flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="size-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="bg-primary/10 h-9 w-20 rounded-md" />
        </div>
      </header>

      <div className="no-scrollbar flex min-h-0 flex-1 justify-center overflow-y-auto px-4 py-6 pb-8 sm:px-6">
        <div className="grid w-full max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Skeleton className="size-24 rounded-xl" />
              <Skeleton className="size-9 rounded-md" />
            </div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-40 w-full rounded-md" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-28 w-full rounded-md" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-28 w-full rounded-md" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full max-w-sm rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
