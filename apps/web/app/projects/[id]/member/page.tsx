import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { WorkItemsData } from '@/app/work-items/_components/work-items-data';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import { buildProjectBreadcrumbOverrides } from '@/app/projects/_helpers/project-links';
import { projectScopedHref } from '@/app/projects/_helpers/project-tree-links';
import { resolveProjectPathParam } from '@/app/projects/_helpers/resolve-project-path';
import { getDbUser } from '@/lib/auth';
import { buildLoginPath } from '@/lib/auth-redirect';
import { getRequestPathForLoginNext } from '@/lib/auth-redirect.server';
import type { RawSearchParams } from '@/lib/search-params';
import { MEMBER_PAGE_SKELETON } from '@/app/member/_components/member-page-meta';

export default async function ProjectMemberPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}>) {
  const dbUser = await getDbUser();
  if (!dbUser) {
    redirect(buildLoginPath(await getRequestPathForLoginNext()));
  }

  const { id: rawParam } = await params;
  const resolvedSearchParams = await searchParams;
  const { project, projectKey } = await resolveProjectPathParam({
    rawParam,
    area: 'member',
    searchParams: resolvedSearchParams,
  });

  return (
    <DashboardShell
      description="Your assigned work in this project."
      breadcrumbOverrides={[
        ...buildProjectBreadcrumbOverrides(project.key, project.name),
        {
          label: 'My Work',
          url: projectScopedHref({
            projectKeyOrId: projectKey,
            area: 'member',
          }),
        },
      ]}
      favoriteLabel={`${project.name} My Work`}
      projectId={project.id}
    >
      <Suspense fallback={<RegistryPageSkeleton {...MEMBER_PAGE_SKELETON} />}>
        <WorkItemsData
          searchParams={searchParams}
          lockedAssigneeId={dbUser.id}
          lockedProjectId={project.id}
          currentUserId={dbUser.id}
        />
      </Suspense>
    </DashboardShell>
  );
}
