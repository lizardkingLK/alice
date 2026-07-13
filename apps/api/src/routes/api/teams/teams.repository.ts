import { supabase } from '../../../lib/supabase';
import { auditCreateWithoutStatus, auditUpdate } from '../../../lib/audit';

export type TeamRow = {
  id: string;
  name: string;
  description: string | null;
  manager_id: string;
  tech_stack: string | null;
  status: 'active' | 'inactive' | 'archived' | 'deleted';
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type TeamRowWithManager = TeamRow & {
  manager?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

function unsafeCast<T>(val: unknown): T {
  return val as T;
}

export class TeamsRepository {
  async listAll(): Promise<TeamRowWithManager[]> {
    const { data, error } = await supabase
      .from('teams')
      .select('*, manager:users!teams_manager_id_fkey(id, name, email)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('database error list all teams:', error.message);
      throw new Error('Failed to retrieve teams list');
    }

    return unsafeCast<TeamRowWithManager[]>(data);
  }

  async listPaginated(
    pageNumber: number,
    pageSize: number,
    teamStatus?: 'active' | 'inactive' | 'archived' | 'deleted',
    searchKeyword?: string
  ): Promise<{ teams: TeamRowWithManager[]; totalCount: number }> {
    const rangeStart = (pageNumber - 1) * pageSize;
    const rangeEnd = rangeStart + pageSize - 1;

    let dbQuery = supabase
      .from('teams')
      .select('*, manager:users!teams_manager_id_fkey(id, name, email)', {
        count: 'exact',
      });

    if (teamStatus) {
      dbQuery = dbQuery.eq('status', teamStatus);
    }

    if (searchKeyword) {
      const likeExpr = `%${searchKeyword}%`;
      dbQuery = dbQuery.or(
        `name.ilike.${likeExpr},description.ilike.${likeExpr},tech_stack.ilike.${likeExpr}`
      );
    }

    const result = await dbQuery
      .order('created_at', { ascending: false })
      .range(rangeStart, rangeEnd);

    if (result.error) {
      console.error(
        'database error list paginated teams:',
        result.error.message
      );
      throw new Error(`Failed to list teams: ${result.error.message}`);
    }

    return {
      teams: unsafeCast<TeamRowWithManager[]>(result.data ?? []),
      totalCount: result.count ?? 0,
    };
  }

  async findByName(name: string, excludeId?: string): Promise<TeamRow | null> {
    let query = supabase.from('teams').select('*').eq('name', name);
    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error('database query error find team by name:', error.message);
      throw new Error('Failed to locate team by name');
    }
    return data;
  }

  async findById(id: string): Promise<TeamRow | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('database query error find team by id:', error.message);
      throw new Error('Failed to locate team by id');
    }
    return data;
  }

  async create(
    teamData: Omit<
      TeamRow,
      'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
    >,
    userId: string
  ): Promise<TeamRow> {
    const payload = {
      ...teamData,
      ...auditCreateWithoutStatus(userId),
    };
    const response = await supabase
      .from('teams')
      .insert(payload)
      .select()
      .single();

    if (response.error) {
      console.error('database failure creating team:', response.error.message);
      throw new Error(`Create team DB error: ${response.error.message}`);
    }

    return response.data;
  }

  async update(
    teamId: string,
    teamData: Partial<
      Omit<
        TeamRow,
        'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
      >
    >,
    userId: string
  ): Promise<TeamRow> {
    const payload = {
      ...teamData,
      ...auditUpdate(userId),
    };
    const response = await supabase
      .from('teams')
      .update(payload)
      .eq('id', teamId)
      .select()
      .single();

    if (response.error) {
      console.error('database failure updating team:', response.error.message);
      throw new Error(`Update team DB error: ${response.error.message}`);
    }

    return response.data;
  }

  async delete(teamId: string): Promise<void> {
    const response = await supabase.from('teams').delete().eq('id', teamId);

    if (response.error) {
      console.error('database failure deleting team:', response.error.message);
      throw new Error(`Delete team DB error: ${response.error.message}`);
    }
  }
}

export const teamsRepository = new TeamsRepository();
