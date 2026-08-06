import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.service.server';
import { getSprintBurndownServer } from '@/app/sprints/_services/sprint-burndown.server';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import type { SprintBurndownPayload } from '@repo/types';

export type DashboardBurndownSprint = Pick<Sprint, 'id' | 'status'> & {
  project?: { id: string } | null;
};

export type DashboardBurndownBootstrap = {
  readonly sprints: DashboardBurndownSprint[];
  readonly defaultSprintId: string | null;
  readonly burndown: SprintBurndownPayload | null;
};

const EMPTY_SPRINTS = {
  sprints: [] as Awaited<
    ReturnType<typeof getSprintsPaginatedServer>
  >['sprints'],
  pagination: {
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 1,
  },
};

/**
 * Prefetch candidates + default Ongoing burndown for the dashboard widget.
 * Direct Supabase RSC reads (PERFORMANCE §2.4 / §3) — no Express hop.
 * Client may re-select using board-defaults localStorage and refetch via action.
 */
export async function getDashboardBurndownBootstrap(): Promise<DashboardBurndownBootstrap> {
  const { sprints } = await safeServerFetch(
    getSprintsPaginatedServer('active', 1, 50),
    EMPTY_SPRINTS,
    'fetch dashboard burndown sprints'
  );

  const candidates: DashboardBurndownSprint[] = sprints
    .filter(
      (sprint) => sprint.status === 'active' || sprint.status === 'planned'
    )
    .map((sprint) => ({
      id: sprint.id,
      status: sprint.status,
      project: sprint.project ? { id: sprint.project.id } : null,
    }));

  const defaultSprint =
    candidates.find((sprint) => sprint.status === 'active') ?? candidates[0];

  if (!defaultSprint) {
    return { sprints: candidates, defaultSprintId: null, burndown: null };
  }

  const burndown = await safeServerFetch(
    getSprintBurndownServer(defaultSprint.id),
    null,
    'fetch dashboard burndown series'
  );

  return {
    sprints: candidates,
    defaultSprintId: defaultSprint.id,
    burndown,
  };
}
