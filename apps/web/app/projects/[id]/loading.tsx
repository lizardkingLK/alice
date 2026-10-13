import { cookies } from 'next/headers';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ProjectDetailsSkeleton } from '@/app/projects/[id]/_components/project-details-skeleton';
import {
  PROJECT_DETAILS_SIDEBAR_COOKIE_NAME,
  parseProjectDetailsSidebarOpenCookie,
} from '@/app/projects/_helpers/project-details-sidebar-storage';

/**
 * `loading.tsx` cannot read `params`. UUID path segments are auto-shortened in
 * `DashboardBreadcrumb`, so the last crumb matches the loaded page (no full→short flash).
 *
 * Sidebar open/collapsed comes from the request cookie (same as the loaded page) —
 * available on the server during streaming; not deferred until client hydration.
 */
export default async function ProjectDetailsLoading() {
  const store = await cookies();
  const sidebarOpen = parseProjectDetailsSidebarOpenCookie(
    store.get(PROJECT_DETAILS_SIDEBAR_COOKIE_NAME)?.value
  );

  return (
    <DashboardShell
      description="Workspace configurations for this project"
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Projects', url: '/projects' },
      ]}
    >
      <ProjectDetailsSkeleton sidebarOpen={sidebarOpen} />
    </DashboardShell>
  );
}
