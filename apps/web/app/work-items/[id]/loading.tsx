import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { WorkItemDetailsSkeleton } from '@/app/work-items/[id]/_components/work-item-details-skeleton';

export default function WorkItemLoading() {
  return (
    <DashboardShell
      description="Work-Item Details"
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Work Items', url: '/work-items' },
        { label: '…', url: '/work-items' },
      ]}
    >
      <WorkItemDetailsSkeleton />
    </DashboardShell>
  );
}
