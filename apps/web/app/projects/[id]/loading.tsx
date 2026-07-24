import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ProjectDetailsSkeleton } from '@/app/projects/[id]/_components/project-details-skeleton';

export default function ProjectDetailsLoading() {
  return (
    <DashboardShell description="Workspace configurations for this project">
      <ProjectDetailsSkeleton />
    </DashboardShell>
  );
}
