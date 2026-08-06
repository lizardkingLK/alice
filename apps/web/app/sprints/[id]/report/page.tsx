import type { Metadata } from 'next';
import { getSprint } from '@/app/sprints/_services/sprints.service.server';
import { getWorkItems } from '@/app/work-items/_services/workItem.service.server';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { notFound } from 'next/navigation';
import { SprintReportView } from './sprint-report-view';
import { AlertCircle, ArrowLeft } from '@repo/ui/lib/icons';
import { toShortId } from '@/app/_shared/utility';

type ReportPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export const metadata: Metadata = {
  title: 'Sprint Summary Report',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SprintReportPage({ params }: ReportPageProps) {
  const { id } = await params;
  const sprint = await getSprint(id);

  if (!sprint) {
    notFound();
  }

  const isValidStatus =
    sprint.status === 'closed' || sprint.status === 'active';

  if (!isValidStatus) {
    return (
      <div className="flex min-h-[75vh] flex-col items-center justify-center p-6 text-center">
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
            <a
              href="/backlog"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-colors hover:bg-indigo-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Backlog
            </a>
          </div>
        </div>
      </div>
    );
  }

  const workItems = await getWorkItems({ sprintId: id });

  const breadcrumbOverrides = [
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
    { label: 'Summary Report', url: `/sprints/${sprint.id}/report` },
  ];

  return (
    <DashboardShell
      breadcrumbOverrides={breadcrumbOverrides}
      breadcrumbAsTrail={true}
      description={`Visual metrics and delivery overview for sprint ${sprint.name}.`}
    >
      <SprintReportView sprint={sprint} workItems={workItems} />
    </DashboardShell>
  );
}
