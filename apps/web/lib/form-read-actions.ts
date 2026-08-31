'use server';

import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { throwIfError } from '@/lib/db/query';
import { getProjectMembers } from '@/app/projects/_services/projects.reads.server';
import type { WorkItemMemberLike } from '@/app/work-items/_helpers/work-item-member';

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

function mapProjectMembersToWorkItemUsers(
  members: Awaited<ReturnType<typeof getProjectMembers>>
): WorkItemMemberLike[] {
  return members
    .map((row) => row.user)
    .filter((user): user is NonNullable<typeof user> => user !== null)
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      profile_picture: user.profile_picture ?? null,
    }));
}

/**
 * Dynamic work-item form read when the user picks a project.
 * Direct Supabase — not Express — per PERFORMANCE.md §6.
 */
export async function fetchProjectMembersForForm(
  projectId: string
): Promise<WorkItemMemberLike[]> {
  const user = await getUser();
  if (!user || !projectId) {
    return [];
  }

  return mapProjectMembersToWorkItemUsers(await getProjectMembers(projectId));
}

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
