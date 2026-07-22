import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { UsersData } from '@/app/users/_components/users-data';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import type { RawSearchParams } from '@/lib/search-params';

export default function UsersDashboard({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <DashboardShell description="Manage application users, assign workspace roles, and control access.">
      <Suspense
        fallback={<RegistryPageSkeleton columnCount={5} rowCount={8} />}
      >
        <UsersData searchParams={searchParams} />
      </Suspense>
    </DashboardShell>
  );
}
