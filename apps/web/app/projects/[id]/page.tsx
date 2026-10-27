import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ProjectDetailsData } from '@/app/projects/[id]/_components/project-details-data';
import { ProjectDetailsSkeleton } from '@/app/projects/[id]/_components/project-details-skeleton';
import {
  buildProjectBreadcrumbOverrides,
  isProjectUuid,
  looksLikeProjectKey,
  projectDetailHref,
  withProjectSearchParams,
} from '@/app/projects/_helpers/project-links';
import {
  PROJECT_DETAILS_SIDEBAR_COOKIE_NAME,
  parseProjectDetailsSidebarOpenCookie,
} from '@/app/projects/_helpers/project-details-sidebar-storage';
import {
  getProject,
  getProjectIdByKey,
} from '@/app/projects/_services/projects.reads.server';
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
  const resolvedSearchParams = await searchParams;

  if (!isProjectUuid(id)) {
    if (!looksLikeProjectKey(id)) {
      notFound();
    }

    const projectId = await safeServerFetch(
      getProjectIdByKey(id),
      null,
      'resolve project id from key'
    );

    if (!projectId) {
      notFound();
    }

    redirect(
      withProjectSearchParams(
        projectDetailHref(projectId),
        resolvedSearchParams
      )
    );
  }

  const [project, cookieStore] = await Promise.all([
    safeServerFetch(getProject(id), null, 'load project for breadcrumb'),
    cookies(),
  ]);

  if (!project) {
    notFound();
  }

  const sidebarOpen = parseProjectDetailsSidebarOpenCookie(
    cookieStore.get(PROJECT_DETAILS_SIDEBAR_COOKIE_NAME)?.value
  );

  return (
    <DashboardShell
      description="Workspace configurations for this project"
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      breadcrumbOverrides={buildProjectBreadcrumbOverrides(id, project.name)}
      favoriteLabel={project.name}
      projectId={id}
    >
      <Suspense fallback={<ProjectDetailsSkeleton sidebarOpen={sidebarOpen} />}>
        <ProjectDetailsData
          projectId={id}
          project={project}
          searchParams={searchParams}
        />
      </Suspense>
    </DashboardShell>
  );
}
