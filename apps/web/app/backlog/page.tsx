import { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { getProjectList } from '@/app/projects/_services/projects.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';
import { getWorkItems, DbWorkItem } from '@/app/work-items/_services/workItem.server.service';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.service.server';
import { getDbUser } from '@/lib/auth';
import { BacklogWorkspace } from './_components/backlog-workspace';

import { Project as DbProject } from '@/app/projects/_services/projects.service';
import { User as DbUser } from '@/app/users/_services/users.service';
import { Sprint } from '@/app/sprints/_services/sprints.service';

export const metadata: Metadata = {
  title: 'Backlog',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function BacklogPage() {
  const dbUser = await getDbUser();
  const userRole = dbUser?.role ?? 'member';

  let projects: DbProject[] = [];
  let projectMembers: DbUser[] = [];
  let initialWorkItems: DbWorkItem[] = [];
  let sprints: Sprint[] = [];
  let error: string | null = null;

  try {
    const [projectsData, membersData, workItemsData, sprintsData] = await Promise.all([
      getProjectList(),
      getUserList(),
      getWorkItems(),
      getSprintsPaginatedServer('active', 1, 100),
    ]);

    projects = projectsData;
    projectMembers = membersData;
    initialWorkItems = workItemsData;
    sprints = sprintsData.sprints;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to fetch backlog data.';
    console.error('Failed to fetch backlog data:', err);
  }

  return (
    <DashboardShell
      description="Plan sprints, prioritize tasks, and manage your product backlog."
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Backlog', url: '/backlog' },
      ]}
    >
      <BacklogWorkspace
        projects={projects}
        projectMembers={projectMembers}
        initialWorkItems={initialWorkItems}
        sprints={sprints}
        userRole={userRole}
        currentUserId={dbUser?.id}
        error={error}
      />
    </DashboardShell>
  );
}
