import { Metadata } from 'next';
import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { SprintsData } from '@/app/sprints/_components/sprints-data';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import type { RawSearchParams } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Sprints',
  robots: {
    index: false,
    follow: false,
  },
};

export default function SprintsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <DashboardShell description="Plan and track team sprints.">
      <Suspense
        fallback={
          <RegistryPageSkeleton columnCount={5} rowCount={6} showTabs />
        }
      >
        <SprintsData searchParams={searchParams} />
      </Suspense>
    </DashboardShell>
  );
}
