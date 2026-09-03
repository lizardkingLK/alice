import { createClient } from '@/lib/supabase/server';
import { projectRelationSelect, Tables } from '@repo/types';

export type ProfileTeam = {
  id: string;
  name: string;
  memberCount: number;
};

export type ProfileWorkedOn = {
  id: string;
  title: string;
  status: Tables<'work_items'>['status'];
  projectKey: string | null;
  updatedAt: string;
};

/**
 * Server-only reads for the profile page. These query Supabase directly from
 * the RSC layer (skipping the `web → api` hop), matching the pattern used by
 * the other list services.
 */

/** Teams the user belongs to, with the team's total member count. */
export async function getProfileTeams(userId: string): Promise<ProfileTeam[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('team_members')
    .select('team:teams!inner(id, name, members:team_members(count))')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.error('error. failed to list profile teams:', error.message);
    throw new Error('Failed to list profile teams');
  }

  type Row = {
    team: {
      id: string;
      name: string;
      members: { count: number }[] | null;
    } | null;
  };

  return ((data ?? []) as unknown as Row[])
    .map((row) => row.team)
    .filter((team): team is NonNullable<Row['team']> => Boolean(team))
    .map((team) => ({
      id: team.id,
      name: team.name,
      memberCount: team.members?.[0]?.count ?? 0,
    }));
}

/** Work items the user is the assignee or reporter of, most recently touched first. */
export async function getProfileWorkedOn(
  userId: string,
  limit = 6
): Promise<ProfileWorkedOn[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('work_items')
    .select(`id, title, status, updated_at, ${projectRelationSelect()}`)
    .eq('record_status', 'active')
    .or(`assignee_id.eq.${userId},reporter_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('error. failed to list profile worked-on:', error.message);
    throw new Error('Failed to list profile worked-on');
  }

  type ProfileWorkedOnRow = Pick<
    Tables<'work_items'>,
    'id' | 'title' | 'status' | 'updated_at'
  > & {
    project: Pick<Tables<'projects'>, 'key' | 'name'> | null;
  };

  return ((data ?? []) as unknown as ProfileWorkedOnRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    projectKey: row.project?.key ?? null,
    updatedAt: row.updated_at,
  }));
}
