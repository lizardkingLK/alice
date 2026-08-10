'use server';

import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { throwIfError } from '@/lib/db/query';
import { getProjectMembers } from '@/app/projects/_services/projects.service.server';

export type ShareViewMemberOption = {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
};

export type ShareViewTeamOption = {
  readonly id: string;
  readonly name: string;
  readonly memberUserIds: readonly string[];
};

export type ShareViewProjectScope = {
  readonly members: ShareViewMemberOption[];
  readonly teams: ShareViewTeamOption[];
};

/**
 * Dynamic share-dialog reads when the user picks a project.
 * Direct Supabase (session client) — not Express — per PERFORMANCE.md §2.4 / §6.
 */
export async function fetchShareViewProjectScope(
  projectId: string
): Promise<ShareViewProjectScope> {
  const user = await getUser();
  if (!user || !projectId) {
    return { members: [], teams: [] };
  }

  const [members, teams] = await Promise.all([
    getProjectMembers(projectId),
    listActiveTeamsWithMembers(projectId),
  ]);

  return {
    members: members.map((row) => ({
      userId: row.user_id,
      name: row.user?.name ?? row.user_id,
      email: row.user?.email ?? '',
      role: row.user?.role ?? '',
    })),
    teams,
  };
}

async function listActiveTeamsWithMembers(
  projectId: string
): Promise<ShareViewTeamOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, members:team_members(user_id, status)')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .order('name', { ascending: true });

  throwIfError(
    error,
    'failed to list teams for share view',
    'Failed to list project teams'
  );

  return (data ?? []).map((team) => ({
    id: team.id,
    name: team.name,
    memberUserIds: (team.members ?? [])
      .filter((member) => member.status === 'active' || !member.status)
      .map((member) => member.user_id),
  }));
}
