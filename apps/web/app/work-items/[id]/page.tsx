import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { WorkItemDetailsData } from '@/app/work-items/[id]/_components/work-item-details-data';
import { WorkItemDetailsSkeleton } from '@/app/work-items/[id]/_components/work-item-details-skeleton';
import {
  buildWorkItemBreadcrumbOverrides,
  FROM_ASSIGNEE_QUERY,
  FROM_PROJECT_QUERY,
} from '@/app/work-items/_helpers/work-item-links';
import type { RawSearchParams } from '@/lib/search-params';

export default async function WorkItemPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}>) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const fromProjectId = resolvedSearchParams[FROM_PROJECT_QUERY] ?? null;
  const fromAssigneeId = resolvedSearchParams[FROM_ASSIGNEE_QUERY] ?? null;
  const breadcrumbOverrides = buildWorkItemBreadcrumbOverrides(id, {
    fromProjectId,
    fromAssigneeId,
  });

  return (
    <DashboardShell
      description="Work-Item Details"
      breadcrumbOverrides={breadcrumbOverrides}
      breadcrumbAsTrail
    >
      <Suspense fallback={<WorkItemDetailsSkeleton />}>
        <WorkItemDetailsData workItemId={id} />
      </Suspense>
    </DashboardShell>
  );
}
