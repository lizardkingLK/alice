import { parseBacklogWorkspaceBundle } from '@/app/backlog/_helpers/backlog-workspace-bundle';
import type { ProjectTeamMemberCapacity } from '@/app/backlog/_helpers/backlog-sprint-capacity';
import type { DbWorkItem } from '@/app/work-items/_types/work-items.reads.types';
import { isMissingRpcError } from '@/lib/db/query';
import { createClient } from '@/lib/supabase/server';
import type { SprintRowWithProject } from '@repo/types';

export type BacklogWorkspaceBundle = {
  readonly workItems: DbWorkItem[];
  readonly sprintRows: SprintRowWithProject[];
  readonly teamCapacities: ProjectTeamMemberCapacity[];
};

/**
 * Backlog fan-in via `get_backlog_workspace_bundle` (work items + active-tab
 * sprints + team capacities). Returns null when the function is missing
 * (pre-migrate) so callers can fall back to parallel PostgREST readers.
 */
export async function getBacklogWorkspaceBundleFromRpc(
  projectIds: readonly string[]
): Promise<BacklogWorkspaceBundle | null> {
  if (projectIds.length === 0) {
    return { workItems: [], sprintRows: [], teamCapacities: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_backlog_workspace_bundle', {
    p_project_ids: [...projectIds],
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return null;
    }
    console.error(
      'error. failed to fetch backlog workspace bundle:',
      error.message
    );
    return null;
  }

  return parseBacklogWorkspaceBundle(data);
}
