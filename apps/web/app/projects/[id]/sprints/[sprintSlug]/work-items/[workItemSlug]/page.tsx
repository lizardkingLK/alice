import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { buildProjectBreadcrumbOverrides } from '@/app/projects/_helpers/project-links';
import { projectScopedHref } from '@/app/projects/_helpers/project-tree-links';
import {
  resolveSprintSlugParam,
  resolveWorkItemSlugParam,
} from '@/app/projects/_helpers/resolve-entity-slug';
import { resolveProjectPathParam } from '@/app/projects/_helpers/resolve-project-path';
import { WorkItemDetailsData } from '@/app/work-items/[id]/_components/work-item-details-data';
import { WorkItemDetailsSkeleton } from '@/app/work-items/[id]/_components/work-item-details-skeleton';
import type { RawSearchParams } from '@/lib/search-params';

export default async function ProjectSprintWorkItemDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{
    id: string;
    sprintSlug: string;
    workItemSlug: string;
  }>;
  searchParams: Promise<RawSearchParams>;
}>) {
  const {
    id: rawParam,
    sprintSlug: rawSprintSlug,
    workItemSlug: rawWorkItemSlug,
  } = await params;
  const resolvedSearchParams = await searchParams;
  const { project, projectKey } = await resolveProjectPathParam({
    rawParam,
    area: 'work-items',
    searchParams: resolvedSearchParams,
    sprintSlug: rawSprintSlug,
    workItemSlug: rawWorkItemSlug,
  });

  const sprint = await resolveSprintSlugParam({
    projectId: project.id,
    projectKey,
    rawSprintSlug,
    searchParams: resolvedSearchParams,
    workItemSlug: rawWorkItemSlug,
  });

  const workItem = await resolveWorkItemSlugParam({
    projectId: project.id,
    projectKey,
    rawWorkItemSlug,
    searchParams: resolvedSearchParams,
    sprintSlug: sprint.slug,
  });

  return (
    <DashboardShell
      description="Work-Item Details"
      breadcrumbOverrides={[
        ...buildProjectBreadcrumbOverrides(project.key, project.name),
        {
          label: 'Sprints',
          url: projectScopedHref({
            projectKeyOrId: projectKey,
            area: 'sprints',
          }),
        },
        {
          label: sprint.name,
          url: projectScopedHref({
            projectKeyOrId: projectKey,
            area: 'sprints',
            sprintSlug: sprint.slug,
            summaryReport: true,
          }),
        },
        {
          label: workItem.title,
          url: projectScopedHref({
            projectKeyOrId: projectKey,
            area: 'work-items',
            sprintSlug: sprint.slug,
            workItemSlug: workItem.slug,
          }),
        },
      ]}
      breadcrumbAsTrail
      favoriteLabel={workItem.title}
      projectId={project.id}
    >
      <Suspense fallback={<WorkItemDetailsSkeleton />}>
        <WorkItemDetailsData workItemId={workItem.id} />
      </Suspense>
    </DashboardShell>
  );
}
