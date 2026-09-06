import type { Metadata } from 'next';
import Link from 'next/link';
import { getSprint } from '@/app/sprints/_services/sprints.reads.server';
import { getWorkItems } from '@/app/work-items/_services/work-items.reads.server';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { notFound } from 'next/navigation';
import { SprintReportView } from './sprint-report-view';
import { AlertCircle, ArrowLeft } from '@repo/ui/lib/icons';
import { toShortId } from '@/app/_shared/utility';
import { SprintStatusEnum } from '@repo/types';
import {
  parseSprintReportFrom,
  sprintReportBackNav,
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

  if (from === 'sprints') {
    return [
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Sprints', url: '/sprints' },
      {
        label: toShortId(sprint.id),
        url: '#',
      },
      { label: 'Summary Report', url: reportUrl },
    ];
  }

  return [
    { label: 'Dashboard', url: '/dashboard' },
    { label: 'Backlog', url: '/backlog' },
    {
      label: sprint.project?.key || 'Project',
      url: sprint.project ? `/projects/${sprint.project.id}` : '#',
    },
    {
      label: toShortId(sprint.id),
      url: '#',
    },
    { label: 'Summary Report', url: reportUrl },
  ];
}

export default async function SprintReportPage({
  params,
  searchParams,
}: ReportPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const from = parseSprintReportFrom(resolvedSearchParams.from);
  const backNav = sprintReportBackNav(from);
  const sprint = await getSprint(id);

  if (!sprint) {
    notFound();
  }

  const isValidStatus =
    sprint.status === SprintStatusEnum.Closed ||
    sprint.status === SprintStatusEnum.Active ||
    sprint.status === SprintStatusEnum.Archived;

  if (!isValidStatus) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center">
        <div className="bg-card border-border/80 max-w-md rounded-2xl border p-8 shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-foreground text-xl font-bold tracking-tight">
            Sprint Report Unavailable
          </h1>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            The Summary Report for{' '}
            <span className="text-foreground font-semibold">
              &quot;{sprint.name}&quot;
            </span>{' '}
            is not available. Reports are only accessible for ongoing or
            completed sprints.
          </p>
          <div className="mt-6">
            <Link
              href={backNav.href}
              className="bg-primary hover:bg-primary/80 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {backNav.label}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const workItems = await getWorkItems({
    sprintId: id,
    projectId: sprint.project?.id,
  });

  return (
    <DashboardShell
      breadcrumbOverrides={buildReportBreadcrumbs(sprint, from)}
      breadcrumbAsTrail={true}
      description={`Visual metrics and delivery overview for sprint ${sprint.name}.`}
    >
      <SprintReportView sprint={sprint} workItems={workItems} />
    </DashboardShell>
  );
}
