import { notFound } from 'next/navigation';
import { ProjectDetailsWorkspace } from '@/app/projects/[id]/_components/project-details-workspace';
import { getProjectWorkspace } from '@/app/projects/_services/project-workspace.server';
import type { RawSearchParams } from '@/lib/search-params';

type ProjectDetailsDataProps = {
  readonly projectId: string;
  readonly searchParams: Promise<RawSearchParams>;
};

export async function ProjectDetailsData({
  projectId,
  searchParams,
}: Readonly<ProjectDetailsDataProps>) {
  const resolvedSearchParams = await searchParams;
  const workspace = await getProjectWorkspace(projectId, resolvedSearchParams);

  if (!workspace) {
    notFound();
  }

  return (
    <div className="w-full">
      <ProjectDetailsWorkspace
        project={workspace.project}
        members={workspace.members}
        allUsers={workspace.allUsers}
        currentUserId={workspace.currentUserId}
        currentUserRole={workspace.currentUserRole}
        workItems={workspace.workItems}
      />
    </div>
  );
}
