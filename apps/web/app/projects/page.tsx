import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ProjectsData } from '@/app/projects/_components/projects-data';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import type { RawSearchParams } from '@/lib/search-params';

export default function ProjectsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <DashboardShell description="Organize project administration.">
      <Suspense
        fallback={
          <RegistryPageSkeleton columnCount={6} rowCount={8} showTabs />
        }
      >
        <ProjectsData searchParams={searchParams} />
      </Suspense>
    </DashboardShell>
  );
}
