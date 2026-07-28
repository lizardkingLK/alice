import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ProjectDetailsData } from '@/app/projects/[id]/_components/project-details-data';
import { ProjectDetailsSkeleton } from '@/app/projects/[id]/_components/project-details-skeleton';
import { toShortId } from '@/app/_shared/utility';
import type { RawSearchParams } from '@/lib/search-params';

export default async function ProjectDetailsPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}>) {
  const { id } = await params;
  const shortId = toShortId(id);

  return (
    <DashboardShell
      description="Workspace configurations for this project"
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Projects', url: '/projects' },
        { label: shortId, url: `/projects/${id}` },
      ]}
    >
      <Suspense fallback={<ProjectDetailsSkeleton />}>
        <ProjectDetailsData projectId={id} searchParams={searchParams} />
      </Suspense>
    </DashboardShell>
  );
}
