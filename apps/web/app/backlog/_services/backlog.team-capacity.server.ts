import { createClient } from '@/lib/supabase/server';
import type { ProjectTeamMemberCapacity } from '@/app/backlog/_helpers/backlog-sprint-capacity';

type TeamCapacityRow = {
  project_id: string | null;
  members:
    | {
        user_id: string;
        capacity: number | null;
        allocation: number | null;
        status: string;
      }[]
    | null;
};

/**
 * Active team memberships with capacity/allocation for the given projects.
 * Used by backlog sprint capacity popovers (same rules as allocation validation).
 */
export async function getProjectTeamMemberCapacities(
  projectIds: readonly string[]
): Promise<ProjectTeamMemberCapacity[]> {
  if (projectIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('teams')
    .select(
      'project_id, members:team_members(user_id, capacity, allocation, status)'
    )
    .eq('status', 'active')
    .in('project_id', [...projectIds]);

  if (error) {
    console.error(
      'error. failed to fetch team capacities for backlog:',
      error.message
    );
    return [];
  }

  const rows = (data ?? []) as TeamCapacityRow[];
  const result: ProjectTeamMemberCapacity[] = [];

  for (const team of rows) {
    if (!team.project_id) {
      continue;
    }
    for (const member of team.members ?? []) {
      if (member.status !== 'active') {
        continue;
      }
      result.push({
        projectId: team.project_id,
        userId: member.user_id,
        capacity: member.capacity,
        allocation: member.allocation,
      });
    }
  }

  return result;
}
