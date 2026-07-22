import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ManagerData } from '@/app/manager/_components/manager-data';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import type { RawSearchParams } from '@/lib/search-params';

export default function ManagerDashboardPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <DashboardShell description="Manage teams workload and engineering resources.">
      <Suspense
        fallback={
          <RegistryPageSkeleton columnCount={6} rowCount={8} showTabs />
        }
      >
        <ManagerData searchParams={searchParams} />
      </Suspense>
    </DashboardShell>
  );
}
