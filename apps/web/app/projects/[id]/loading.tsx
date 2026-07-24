import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ProjectDetailsSkeleton } from '@/app/projects/[id]/_components/project-details-skeleton';

/**
 * `loading.tsx` cannot read `params`. UUID path segments are auto-shortened in
 * `DashboardBreadcrumb`, so the last crumb matches the loaded page (no full→short flash).
 */
export default function ProjectDetailsLoading() {
  return (
    <DashboardShell
      description="Workspace configurations for this project"
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Projects', url: '/projects' },
      ]}
    >
      <ProjectDetailsSkeleton />
    </DashboardShell>
  );
}
