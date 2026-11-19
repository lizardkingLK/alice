import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.reads.server';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { ReportsWorkspace } from './reports-workspace';

const SPRINT_PAGE_SIZE = 100;

async function listSprints(
  tab: 'active' | 'archived',
  projectIds: readonly string[]
): Promise<Sprint[]> {
  const first = await getSprintsPaginatedServer(
    tab,
    1,
    SPRINT_PAGE_SIZE,
    undefined,
    { projectIds: [...projectIds] }
  );
  if (first.pagination.totalPages <= 1) {
    return first.sprints;
  }

  const remaining = await Promise.all(
    Array.from({ length: first.pagination.totalPages - 1 }, (_, index) =>
      getSprintsPaginatedServer(tab, index + 2, SPRINT_PAGE_SIZE, undefined, {
        projectIds: [...projectIds],
      })
    )
  );
  return [first, ...remaining].flatMap((page) => page.sprints);
}

export async function ReportsData({ userId }: { readonly userId: string }) {
  const projects = await safeServerFetch(
    getAccessibleProjectList(userId),
    [],
    'fetch projects for reports'
  );
  const projectIds = projects.map((project) => project.id);
  const [currentSprints, archivedSprints] = await Promise.all([
    safeServerFetch(
      listSprints('active', projectIds),
      [],
      'fetch current sprints for reports'
    ),
    safeServerFetch(
      listSprints('archived', projectIds),
      [],
      'fetch archived sprints for reports'
    ),
  ]);

  const allowedProjects = new Set(projectIds);
  const sprints = [...currentSprints, ...archivedSprints]
    .filter(
      (sprint, index, all) =>
        sprint.project?.id &&
        allowedProjects.has(sprint.project.id) &&
        all.findIndex((candidate) => candidate.id === sprint.id) === index
    )
    .map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      projectId: sprint.project!.id,
    }));

  return (
    <ReportsWorkspace
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        key: project.key,
      }))}
      sprints={sprints}
    />
  );
}
