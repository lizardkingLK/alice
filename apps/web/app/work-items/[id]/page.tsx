import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { WorkItemDetailsData } from '@/app/work-items/[id]/_components/work-item-details-data';
import { WorkItemDetailsSkeleton } from '@/app/work-items/[id]/_components/work-item-details-skeleton';
import { toShortId } from '@/app/_shared/utility';

export default async function WorkItemPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const shortId = toShortId(id);

  return (
    <DashboardShell
      description="Work-Item Details"
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Work Items', url: '/work-items' },
        { label: shortId, url: `/work-items/${id}` },
      ]}
    >
      <Suspense fallback={<WorkItemDetailsSkeleton />}>
        <WorkItemDetailsData workItemId={id} />
      </Suspense>
    </DashboardShell>
  );
}
