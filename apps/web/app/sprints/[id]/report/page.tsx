import type { Metadata } from 'next';
import { getSprint } from '@/app/sprints/_services/sprints.reads.server';
import { getWorkItems } from '@/app/work-items/_services/work-items.reads.server';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { notFound } from 'next/navigation';
import { SprintReportView } from './sprint-report-view';
import { SprintReportPlaceholder } from './sprint-report-placeholder';
import { toShortId } from '@/app/_shared/utility';
import { SprintStatusEnum } from '@repo/types';
import {
  parseSprintReportFrom,
  sprintReportHref,
  type SprintReportFrom,
} from '@/app/sprints/_helpers/sprint-report-links';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';

type ReportPageProps = Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}>;

export const metadata: Metadata = {
  title: 'Sprint Summary Report',
  robots: {
    index: false,
    follow: false,
  },
};

function buildReportBreadcrumbs(
  sprint: Sprint,
  from: SprintReportFrom
): { label: string; url: string }[] {
  const reportUrl = sprintReportHref(sprint.id, from);
  const sprintLabel = sprint.name?.trim() || toShortId(sprint.id);

  if (from === 'sprints') {
    return [
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Sprints', url: '/sprints' },
      {
        label: sprintLabel,
        url: '#',
      },
      { label: 'Summary Report', url: reportUrl },
    ];
  }

  return [
    { label: 'Dashboard', url: '/dashboard' },
    { label: 'Backlog', url: '/backlog' },
    {
      label: sprint.project?.name?.trim() || sprint.project?.key || 'Project',
      url: sprint.project ? `/projects/${sprint.project.id}` : '#',
    },
    {
      label: sprintLabel,
      url: '#',
    },
    { label: 'Summary Report', url: reportUrl },
  ];
}

function isLiveReportStatus(status: Sprint['status']): boolean {
  return (
    status === SprintStatusEnum.Closed ||
    status === SprintStatusEnum.Active ||
    status === SprintStatusEnum.Archived
  );
}

export default async function SprintReportPage({
  params,
  searchParams,
}: ReportPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const from = parseSprintReportFrom(resolvedSearchParams.from);
  const sprint = await getSprint(id);

  if (!sprint) {
    notFound();
  }

  const showLiveReport = isLiveReportStatus(sprint.status);

  const workItems = showLiveReport
    ? await getWorkItems({
        sprintId: id,
        projectId: sprint.project?.id,
      })
    : [];

  return (
    <DashboardShell
      breadcrumbOverrides={buildReportBreadcrumbs(sprint, from)}
      breadcrumbAsTrail={true}
      description={
        showLiveReport
          ? `Visual metrics and delivery overview for sprint ${sprint.name}.`
          : `Summary report for ${sprint.name} unlocks when the sprint is active or completed.`
      }
    >
      {showLiveReport ? (
        <SprintReportView sprint={sprint} workItems={workItems} />
      ) : (
        <SprintReportPlaceholder sprint={sprint} />
      )}
    </DashboardShell>
  );
}
