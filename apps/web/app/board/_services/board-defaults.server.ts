import { createClient } from '@/lib/supabase/server';
import { throwIfError } from '@/lib/db/query';

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
  resolveDefaultBoardProject,
  resolveDefaultBoardSprint,
} from './board-defaults';
