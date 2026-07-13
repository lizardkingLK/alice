import { redirect, notFound } from 'next/navigation';
import { getUser, getDbUser } from '@/lib/auth';
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

  const user = await getUser();
  if (!user) {
    redirect('/login');
  }

  const dbUser = await getDbUser();
  const userRole = dbUser?.role ?? 'member';

  let project;
  let members = [];
  try {
    project = await getProjectDetails(projectId);
    members = await getProjectMembers(projectId);
  } catch (error) {
    console.error('Failed to load project details:', error);
    notFound();
  }

  const allUsers = (await getUserList()) ?? [];

  return (
    <DashboardShell
      title="Projects"
      description={`Workspace configurations for ${project.name}`}
      user={user}
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
