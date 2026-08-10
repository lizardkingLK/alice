import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { WorkItemDetailsData } from '@/app/work-items/[id]/_components/work-item-details-data';
import { WorkItemDetailsSkeleton } from '@/app/work-items/[id]/_components/work-item-details-skeleton';
import { buildWorkItemBreadcrumbOverrides } from '@/app/work-items/_helpers/work-item-links';
import { getWorkItem } from '@/app/work-items/_services/workItem.service.server';

export default async function WorkItemPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const workItem = await getWorkItem(id);

  if (!workItem) {
    redirect('/dashboard');
  }

  const breadcrumbOverrides = buildWorkItemBreadcrumbOverrides(
    id,
    workItem.project_id
  );

  return (
    <DashboardShell
      description="Work-Item Details"
      breadcrumbOverrides={breadcrumbOverrides}
      breadcrumbAsTrail
      favoriteLabel={workItem.title}
      projectId={workItem.project_id}
    >
      <Suspense fallback={<WorkItemDetailsSkeleton />}>
        <WorkItemDetailsData workItemId={id} />
      </Suspense>
    </DashboardShell>
  );
}
