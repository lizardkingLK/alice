import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { SETTINGS_BREADCRUMBS } from '@/app/settings/_components/settings-page-meta';
import { Skeleton } from '@repo/ui/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <DashboardShell
      sidebarDefaultOpen={false}
      contentClassName="p-0"
      breadcrumbOverrides={SETTINGS_BREADCRUMBS}
      breadcrumbAsTrail
    >
      <div className="bg-background flex min-h-full flex-col md:flex-row">
        <aside className="border-border w-full shrink-0 border-b p-4 md:w-56 md:border-r md:border-b-0">
          <Skeleton className="mb-5 h-7 w-24" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </aside>
        <div className="min-w-0 flex-1 space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full max-w-xl" />
        </div>
      </div>
    </DashboardShell>
  );
}
