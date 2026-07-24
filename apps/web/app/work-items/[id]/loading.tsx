import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { WorkItemDetailsSkeleton } from '@/app/work-items/[id]/_components/work-item-details-skeleton';

/**
 * `loading.tsx` cannot read `params`. UUID path segments are auto-shortened in
 * `DashboardBreadcrumb`, so the last crumb matches the loaded page (no …→short flash).
 */
export default function WorkItemLoading() {
  return (
    <DashboardShell
      description="Work-Item Details"
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Work Items', url: '/work-items' },
      ]}
    >
      <WorkItemDetailsSkeleton />
    </DashboardShell>
  );
}
