import { BacklogWorkspace } from '@/app/backlog/_components/backlog-workspace';
import { getBacklogWorkspace } from '@/app/backlog/_services/backlog.reads.server';

type BacklogDataProps = {
  readonly lockedProjectId?: string;
};

export async function BacklogData(
  { lockedProjectId }: Readonly<BacklogDataProps> = {} as BacklogDataProps
) {
  const {
    projects,
    projectMembers,
    teamCapacities,
    initialWorkItems,
    sprints,
    userRole,
    currentUserId,
    error,
  } = await getBacklogWorkspace();

  const scopedProjects = lockedProjectId
    ? projects.filter((project) => project.id === lockedProjectId)
    : projects;

  return (
    <BacklogWorkspace
      projects={scopedProjects.length > 0 ? scopedProjects : projects}
      projectMembers={projectMembers}
      teamCapacities={teamCapacities}
      initialWorkItems={initialWorkItems}
      sprints={sprints}
      userRole={userRole}
      currentUserId={currentUserId}
      error={error}
      lockedProjectId={lockedProjectId}
    />
  );
}
