import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { BacklogPageSkeleton } from '@/app/backlog/_components/backlog-page-skeleton';

const BACKLOG_BREADCRUMBS = [
  { label: 'Dashboard', url: '/dashboard' },
  { label: 'Backlog', url: '/backlog' },
] as const;

export default function BacklogLoading() {
  return (
    <DashboardShell
      description="Plan sprints, prioritize tasks, and manage your product backlog."
      breadcrumbOverrides={[...BACKLOG_BREADCRUMBS]}
    >
      <BacklogPageSkeleton />
    </DashboardShell>
  );
}
