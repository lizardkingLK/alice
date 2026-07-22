import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { WorkItemsData } from '@/app/work-items/_components/work-items-data';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import type { RawSearchParams } from '@/lib/search-params';

export default function WorkItemsDashboard({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <DashboardShell description="Manage Work Items.">
      <Suspense
        fallback={<RegistryPageSkeleton columnCount={7} rowCount={8} />}
      >
        <WorkItemsData searchParams={searchParams} />
      </Suspense>
    </DashboardShell>
  );
}
