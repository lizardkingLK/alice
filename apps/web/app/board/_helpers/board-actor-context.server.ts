import type { UserRole } from '@repo/types';
import type { TransitionRuleActorContext } from '@repo/types/api/v1';
import { createClient } from '@/lib/supabase/server';

function logBoardActorContextError(label: string, message: string): null {
  console.error(
    `error. failed to load ${label} for board transition auth:`,
    message
  );
  return null;
}

/**
 * Resolve role / membership / active team ids for board transition matchers.
 * Mirrors API `getBoardActorContext` using Supabase (web has no Prisma).
 */
export async function getBoardTransitionActorContext(
  userId: string,
  projectId: string,
  role: UserRole
): Promise<TransitionRuleActorContext | null> {
  const supabase = await createClient();

  const [membershipResult, teamsResult] = await Promise.all([
    supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('teams')
      .select('id, members:team_members!inner(user_id, status)')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .eq('members.user_id', userId)
      .eq('members.status', 'active'),
  ]);

  if (membershipResult.error) {
    return logBoardActorContextError(
      'project membership',
      membershipResult.error.message
    );
  }

  if (teamsResult.error) {
    return logBoardActorContextError(
      'team membership',
      teamsResult.error.message
    );
  }

  return {
    role,
    isActiveProjectMember: membershipResult.data != null,
    activeTeamIds: (teamsResult.data ?? []).map((team) => team.id),
  };
}
