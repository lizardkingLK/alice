import type { Metadata } from 'next';
import { SprintStatusEnum } from '@repo/types';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { buildProjectBreadcrumbOverrides } from '@/app/projects/_helpers/project-links';
import { projectScopedHref } from '@/app/projects/_helpers/project-tree-links';
import { resolveSprintSlugParam } from '@/app/projects/_helpers/resolve-entity-slug';
import { resolveProjectPathParam } from '@/app/projects/_helpers/resolve-project-path';
import { SprintReportPlaceholder } from '@/app/sprints/[id]/report/sprint-report-placeholder';
import { SprintReportView } from '@/app/sprints/[id]/report/sprint-report-view';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { getWorkItems } from '@/app/work-items/_services/work-items.reads.server';
import type { RawSearchParams } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Sprint Summary Report',
  robots: {
    index: false,
    follow: false,
  },
};

function isLiveReportStatus(status: Sprint['status']): boolean {
  return (
    status === SprintStatusEnum.Closed ||
    status === SprintStatusEnum.Active ||
    status === SprintStatusEnum.Archived
  );
}

export default async function ProjectSprintSummaryReportPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string; sprintSlug: string }>;
  searchParams: Promise<RawSearchParams>;
}>) {
  const { id: rawParam, sprintSlug: rawSprintSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const { project, projectKey } = await resolveProjectPathParam({
    rawParam,
    area: 'sprints',
    searchParams: resolvedSearchParams,
    sprintSlug: rawSprintSlug,
    summaryReport: true,
  });

  const sprint = await resolveSprintSlugParam({
    projectId: project.id,
    projectKey,
    rawSprintSlug,
    searchParams: resolvedSearchParams,
    summaryReport: true,
  });

  const showLiveReport = isLiveReportStatus(sprint.status);
  const workItems = showLiveReport
    ? await getWorkItems({
        sprintId: sprint.id,
        projectId: project.id,
      })
    : [];

  const reportUrl = projectScopedHref({
    projectKeyOrId: projectKey,
    area: 'sprints',
    sprintSlug: sprint.slug,
    summaryReport: true,
  });

  return (
    <DashboardShell
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
          url: reportUrl,
        },
      ]}
      breadcrumbAsTrail
      description={
        showLiveReport
          ? `Visual metrics and delivery overview for sprint ${sprint.name}.`
          : `Summary report for ${sprint.name} unlocks when the sprint is active or completed.`
      }
      favoriteLabel={`${sprint.name} Report`}
      projectId={project.id}
    >
      {showLiveReport ? (
        <SprintReportView sprint={sprint} workItems={workItems} />
      ) : (
        <SprintReportPlaceholder sprint={sprint} />
      )}
    </DashboardShell>
  );
}
