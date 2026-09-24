import { createClient } from '@/lib/supabase/server';
import { throwIfError } from '@/lib/db/query';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';

/**
 * Active project ids where the user is an active project member.
 */
export async function getActiveMemberProjectIds(
  userId: string
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  throwIfError(
    error,
    'failed to list member projects',
    'Failed to list member projects'
  );

  return (data ?? []).map((row) => row.project_id);
}

export {
  buildBoardFilterRedirectPath,
  buildWorkspaceFilterRedirectPath,
  resolveDefaultBoardProject,
  resolveDefaultBoardSprint,
} from './board.defaults.shared';

/** Fallback when active-sprint list fetch fails (board / backlog / work-items). */
export const EMPTY_ACTIVE_SPRINTS_PAGE = {
  sprints: [] as Sprint[],
  pagination: { page: 1, limit: 100, totalCount: 0, totalPages: 1 },
};
