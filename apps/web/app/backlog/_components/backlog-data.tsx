import { BacklogWorkspace } from '@/app/backlog/_components/backlog-workspace';
import { getBacklogWorkspace } from '@/app/backlog/_services/backlog.service.server';

export async function BacklogData() {
  const {
    projects,
    projectMembers,
    initialWorkItems,
    sprints,
    userRole,
    currentUserId,
    error,
  } = await getBacklogWorkspace();

  return (
    <BacklogWorkspace
      projects={projects}
      projectMembers={projectMembers}
      initialWorkItems={initialWorkItems}
      sprints={sprints}
      userRole={userRole}
      currentUserId={currentUserId}
      error={error}
    />
  );
}
