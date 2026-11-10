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
  normalizeProjectKey,
  projectDetailHref,
  withProjectSearchParams,
} from '@/app/projects/_helpers/project-links';
import { projectScopedHref } from '@/app/projects/_helpers/project-tree-links';
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
  const { id: rawParam } = await params;
  const resolvedSearchParams = await searchParams;

  if (isProjectUuid(rawParam)) {
    const projectById = await safeServerFetch(
      getProject(rawParam),
      null,
      'load project for key redirect'
    );
    if (!projectById) {
      notFound();
    }

    redirect(
      withProjectSearchParams(
        projectDetailHref(projectById.key),
        resolvedSearchParams
      )
    );
  }

  if (!looksLikeProjectKey(rawParam)) {
    notFound();
  }

  const canonicalKey = normalizeProjectKey(rawParam);
  if (rawParam !== canonicalKey) {
    redirect(
      withProjectSearchParams(
        projectDetailHref(canonicalKey),
        resolvedSearchParams
      )
    );
  }

  // Legacy `?tab=` bookmarks for Board/Backlog/My Work (those surfaces live
  // outside the project shell). Work Items + Sprints stay as in-shell tabs.
  const legacyTreeTab = resolvedSearchParams.tab;
  if (legacyTreeTab === 'backlog' || legacyTreeTab === 'member') {
    const rest: RawSearchParams = { ...resolvedSearchParams };
    delete rest.tab;
    redirect(
      withProjectSearchParams(
        projectScopedHref({
          projectKeyOrId: canonicalKey,
          area: legacyTreeTab,
        }),
        rest
      )
    );
  }

  const projectId = await safeServerFetch(
    getProjectIdByKey(canonicalKey),
    null,
    'resolve project id from key'
  );

  if (!projectId) {
    notFound();
  }

  const [project, cookieStore] = await Promise.all([
    safeServerFetch(getProject(projectId), null, 'load project for breadcrumb'),
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
      breadcrumbOverrides={buildProjectBreadcrumbOverrides(
        project.key,
        project.name
      )}
      favoriteLabel={project.name}
      projectId={projectId}
    >
      <Suspense fallback={<ProjectDetailsSkeleton sidebarOpen={sidebarOpen} />}>
        <ProjectDetailsData
          projectId={projectId}
          project={project}
          searchParams={searchParams}
        />
      </Suspense>
    </DashboardShell>
  );
}
