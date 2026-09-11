import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ProjectDetailsData } from '@/app/projects/[id]/_components/project-details-data';
import { ProjectDetailsSkeleton } from '@/app/projects/[id]/_components/project-details-skeleton';
import { buildProjectBreadcrumbOverrides } from '@/app/projects/_helpers/project-links';
import { getProject } from '@/app/projects/_services/projects.reads.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import type { RawSearchParams } from '@/lib/search-params';

export default async function ProjectDetailsPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}>) {
  const { id } = await params;
  const project = await safeServerFetch(
    getProject(id),
    null,
    'load project for breadcrumb'
  );

  if (!project) {
    notFound();
  }

  return (
    <DashboardShell
      description="Workspace configurations for this project"
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      breadcrumbOverrides={buildProjectBreadcrumbOverrides(id, project.name)}
      favoriteLabel={project.name}
      projectId={id}
    >
      <Suspense fallback={<ProjectDetailsSkeleton />}>
        <ProjectDetailsData projectId={id} searchParams={searchParams} />
      </Suspense>
    </DashboardShell>
  );
}
