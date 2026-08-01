export function DashboardOverviewSkeleton() {
  return (
    <div
      className="w-full space-y-4"
      aria-busy="true"
      aria-label="Loading dashboard overview"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="bg-muted/40 h-10 w-72 max-w-full animate-pulse rounded-md" />
        <div className="bg-muted/40 h-8 w-28 animate-pulse rounded-md" />
      </div>
      <div className="bg-muted/20 h-112 animate-pulse rounded-xl" />
    </div>
  );
}
