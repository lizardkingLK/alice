import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { WorkItemDetailsSkeleton } from '@/app/work-items/[id]/_components/work-item-details-skeleton';

/**
 * `loading.tsx` cannot read `params` / project id. Match the project-scoped
 * trail shape; UUID segments resolve once the page loads.
 */
export default function WorkItemLoading() {
  return (
    <DashboardShell
      description="Work-Item Details"
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Projects', url: '/projects' },
        { label: 'Work Items', url: '/work-items' },
      ]}
    >
      <WorkItemDetailsSkeleton />
    </DashboardShell>
  );
}
