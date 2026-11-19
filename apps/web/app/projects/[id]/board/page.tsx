import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { BoardData } from '@/app/board/_components/board-data';
import { BoardPageSkeleton } from '@/app/board/_components/board-page-skeleton';
import { buildProjectBreadcrumbOverrides } from '@/app/projects/_helpers/project-links';
import { projectScopedHref } from '@/app/projects/_helpers/project-tree-links';
import { resolveProjectPathParam } from '@/app/projects/_helpers/resolve-project-path';
import type { RawSearchParams } from '@/lib/search-params';

export default async function ProjectBoardPage({
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
    area: 'board',
    searchParams: resolvedSearchParams,
  });

  const injectedSearchParams = Promise.resolve({
    ...resolvedSearchParams,
    project: project.id,
  });

  return (
    <DashboardShell
      description="Track progress, update task statuses, and organize work-items in real-time."
      breadcrumbOverrides={[
        ...buildProjectBreadcrumbOverrides(project.key, project.name),
        {
          label: 'Board',
          url: projectScopedHref({ projectKeyOrId: projectKey, area: 'board' }),
        },
      ]}
      contentScrollable={false}
      favoriteLabel={`${project.name} Board`}
      projectId={project.id}
    >
      <Suspense fallback={<BoardPageSkeleton />}>
        <BoardData searchParams={injectedSearchParams} />
      </Suspense>
    </DashboardShell>
  );
}
