import { notFound } from 'next/navigation';
import { ProjectDetailsWorkspace } from '@/app/projects/[id]/_components/project-details-workspace';
import { ProjectWorkspaceAccessDenied } from '@/app/projects/[id]/_components/project-workspace-access-denied';
import { getProjectWorkspace } from '@/app/projects/_services/project-workspace.server';
import { readWorkItemTableColumnVisibilityBootstrap } from '@/app/work-items/_helpers/work-item-table-columns-cookie.server';
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
  const [workspace, columnVisibilityBootstrap] = await Promise.all([
    getProjectWorkspace(projectId, resolvedSearchParams),
    readWorkItemTableColumnVisibilityBootstrap(),
  ]);

  if (!workspace) {
    notFound();
  }

  if (workspace.access === 'denied') {
    return (
      <div className="w-full py-8">
        <ProjectWorkspaceAccessDenied
          projectName={workspace.project.name}
          projectKey={workspace.project.key}
        />
      </div>
    );
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
        teams={workspace.teams}
        initialColumnVisibility={columnVisibilityBootstrap.visibility}
        columnVisibilityHasCookie={columnVisibilityBootstrap.hasCookie}
      />
    </div>
  );
}
