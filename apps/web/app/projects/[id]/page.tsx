import { notFound } from 'next/navigation';
import { getDbUser } from '@/lib/auth';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import {
  getProjectDetails,
  getProjectMembers,
} from '../_services/projects.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';
import { ProjectDetailsWorkspace } from './_components/project-details-workspace';

export default async function ProjectDetailsPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  const [dbUser, projectBundle, allUsers] = await Promise.all([
    getDbUser(),
    Promise.all([
      getProjectDetails(projectId),
      getProjectMembers(projectId),
    ]).catch((error: unknown) => {
      console.error('Failed to load project details:', error);
      return null;
    }),
    getUserList().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('error. failed to fetch users via API:', message);
      return [];
    }),
  ]);

  if (!projectBundle) {
    notFound();
  }

  const [project, members] = projectBundle;
  const userRole = dbUser?.role ?? 'member';

  return (
    <DashboardShell
      description={`Workspace configurations for ${project.name}`}
    >
      <div className="w-full">
        <ProjectDetailsWorkspace
          project={project}
          members={members}
          allUsers={allUsers}
          currentUserId={dbUser?.id}
          currentUserRole={userRole}
        />
      </div>
    </DashboardShell>
  );
}
