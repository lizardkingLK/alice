import { notFound } from 'next/navigation';
import { getDbUser } from '@/lib/auth';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import {
  getProjectDetails,
  getProjectMembers,
  type Project,
  type ProjectMemberWithUser,
} from '../_services/projects.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';
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
    safeServerFetch<[Project, ProjectMemberWithUser[]] | null>(
      Promise.all([getProjectDetails(projectId), getProjectMembers(projectId)]),
      null,
      'load project details'
    ),
    safeServerFetch(getUserList(), [], 'fetch users via API'),
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
