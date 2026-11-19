import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { BacklogData } from '@/app/backlog/_components/backlog-data';
import { BacklogPageSkeleton } from '@/app/backlog/_components/backlog-page-skeleton';
import { buildProjectBreadcrumbOverrides } from '@/app/projects/_helpers/project-links';
import { projectScopedHref } from '@/app/projects/_helpers/project-tree-links';
import { resolveProjectPathParam } from '@/app/projects/_helpers/resolve-project-path';
import type { RawSearchParams } from '@/lib/search-params';

export default async function ProjectBacklogPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}>) {
  const { id: rawParam } = await params;
  const resolvedSearchParams = await searchParams;
  const { project, projectKey } = await resolveProjectPathParam({
    rawParam,
    area: 'backlog',
    searchParams: resolvedSearchParams,
  });

  return (
    <DashboardShell
      description="Plan sprints, prioritize tasks, and manage your product backlog."
      breadcrumbOverrides={[
        ...buildProjectBreadcrumbOverrides(project.key, project.name),
        {
          label: 'Backlog',
          url: projectScopedHref({
            projectKeyOrId: projectKey,
            area: 'backlog',
          }),
        },
      ]}
      favoriteLabel={`${project.name} Backlog`}
      projectId={project.id}
    >
      <Suspense fallback={<BacklogPageSkeleton />}>
        <BacklogData lockedProjectId={project.id} />
      </Suspense>
    </DashboardShell>
  );
}
