import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { Skeleton } from '@repo/ui/components/ui/skeleton';

export default function CalendarEventDetailsLoading() {
  return (
    <DashboardShell
      description="Details of the scheduled item"
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Calendar', url: '/calendar' },
      ]}
    >
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-50" />
        <Skeleton className="h-4 w-75" />
        <Skeleton className="h-50 w-full" />
      </div>
    </DashboardShell>
  );
}
