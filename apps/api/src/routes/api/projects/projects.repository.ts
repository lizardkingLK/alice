import { USER_PROJECTION_WITH_ROLE, userRelationSelect } from '@repo/types';
import { supabase } from '../../../lib/supabase';
import {
  auditCreate,
  auditCreateWithoutStatus,
  auditUpdate,
} from '../../../lib/audit';

export type ProjectRow = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status: 'active' | 'archived';
  start_date: string | null;
  end_date: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  jira_url: string | null;
  jira_email: string | null;
  jira_token: string | null;
  jira_project_key: string | null;
};

export type ProjectRowWithOwner = ProjectRow & {
  owner?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type ProjectMemberWithUser = {
  project_id: string;
  user_id: string;
  status: 'active' | 'inactive' | 'archived' | 'deleted';
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    profile_picture?: string | null;
  } | null;
};

const PROJECT_MEMBER_USER_SELECT = userRelationSelect(
  'user',
  'project_members_user_id_fkey',
  USER_PROJECTION_WITH_ROLE
);

function unsafeCast<T>(val: unknown): T {
  return val as T;
}

export class ProjectsRepository {
  async listAll(): Promise<ProjectRowWithOwner[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, owner:users!projects_owner_id_fkey(id, name, email)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('error. failed to list projects:', error.message);
      throw new Error('Failed to list projects');
    }

    return unsafeCast<ProjectRowWithOwner[]>(data);
  }

  async listPaginated(
    page: number,
    limit: number,
    status?: 'active' | 'archived',
    search?: string
  ): Promise<{ projects: ProjectRowWithOwner[]; totalCount: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('projects')
      .select('*, owner:users!projects_owner_id_fkey(id, name, email)', {
        count: 'exact',
      });

    // Handle soft deleted vs active status
    if (status === 'archived') {
      query = query.not('deleted_at', 'is', null);
    } else {
      query = query.is('deleted_at', null);
    }

    // Handle search query
    if (search) {
      const sanitized = `%${search}%`;
      query = query.or(
        `name.ilike.${sanitized},key.ilike.${sanitized},description.ilike.${sanitized}`
      );
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('error. failed to list projects paginated:', error.message);
      throw new Error('Failed to list projects');
    }

    return {
      projects: unsafeCast<ProjectRowWithOwner[]>(data ?? []),
      totalCount: count ?? 0,
    };
  }

  async findByKey(key: string, excludeId?: string): Promise<ProjectRow | null> {
    let query = supabase.from('projects').select('*').eq('key', key);
    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error('error. failed to find project by key:', error.message);
      throw new Error('Failed to find duplicate project key');
    }
    return data;
  }

  async findById(id: string): Promise<ProjectRowWithOwner | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, owner:users!projects_owner_id_fkey(id, name, email)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('error. failed to find project by id:', error.message);
      throw new Error('Failed to find project');
    }
    return unsafeCast<ProjectRowWithOwner | null>(data);
  }

  async listMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select(`*, ${PROJECT_MEMBER_USER_SELECT}`)
      .eq('project_id', projectId)
      .eq('status', 'active');

    if (error) {
      console.error('error. failed to list project members:', error.message);
      throw new Error('Failed to list project members');
    }

    return unsafeCast<ProjectMemberWithUser[]>(data);
  }

  async addMember(
    projectId: string,
    userId: string,
    actorId: string
  ): Promise<void> {
    const payload = {
      project_id: projectId,
      user_id: userId,
      ...auditCreate(actorId),
    };
    const { error } = await supabase.from('project_members').insert(payload);

    if (error) {
      console.error('error. failed to add project member:', error.message);
      throw new Error(
        `Database failed to add project member: ${error.message}`
      );
    }
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    const { data: projectTeams, error: teamsError } = await supabase
      .from('teams')
      .select('id')
      .eq('project_id', projectId);

    if (teamsError) {
      console.error(
        'error. failed to list project teams for member removal:',
        teamsError.message
      );
      throw new Error('Failed to remove project member team assignments');
    }

    const teamIds = (projectTeams ?? []).map((team) => team.id);

    if (teamIds.length > 0) {
      const { error: reportingError } = await supabase
        .from('team_members')
        .update({ reporting_line: null })
        .in('team_id', teamIds)
        .eq('reporting_line', userId);

      if (reportingError) {
        console.error(
          'error. failed to clear team reporting lines:',
          reportingError.message
        );
        throw new Error('Failed to remove project member team assignments');
      }

      const { error: membersError } = await supabase
        .from('team_members')
        .delete()
        .in('team_id', teamIds)
        .eq('user_id', userId);

      if (membersError) {
        console.error(
          'error. failed to remove team memberships:',
          membersError.message
        );
        throw new Error('Failed to remove project member team assignments');
      }
    }

    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      console.error('error. failed to remove project member:', error.message);
      throw new Error(
        `Database failed to remove project member: ${error.message}`
      );
    }
  }

  async create(
    data: Omit<ProjectRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
    actorId: string
  ): Promise<ProjectRow> {
    const insertData = {
      ...data,
      deleted_at: null,
      ...auditCreateWithoutStatus(actorId),
    };
    const { data: created, error } = await supabase
      .from('projects')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('error. failed to create project:', error.message);
      throw new Error(`Database insertion failed: ${error.message}`);
    }

    return created;
  }

  async update(
    id: string,
    data: Partial<Omit<ProjectRow, 'id' | 'created_at' | 'updated_at'>>,
    actorId: string
  ): Promise<ProjectRow> {
    const updateData = {
      ...data,
      ...auditUpdate(actorId),
    };
    const { data: updated, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('error. failed to update project:', error.message);
      throw new Error(`Database update failed: ${error.message}`);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('projects').delete().eq('id', id);

    if (error) {
      console.error('error. failed to delete project:', error.message);
      throw new Error(`Database delete failed: ${error.message}`);
    }
  }

  async getJiraSettings(): Promise<{
    jira_url: string;
    jira_email: string;
    jira_token: string;
  } | null> {
    const { data, error } = await supabase
      .from('jira_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('error. failed to fetch Jira settings:', error.message);
      return null;
    }
    return data;
  }

  async saveJiraSettings(
    url: string,
    email: string,
    token: string
  ): Promise<void> {
    const { data: existing, error: findError } = await supabase
      .from('jira_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error(
        'error. failed to check existing Jira settings:',
        findError.message
      );
      throw new Error('Database check failed');
    }

    if (existing?.id) {
      const { error } = await supabase
        .from('jira_settings')
        .update({ jira_url: url, jira_email: email, jira_token: token })
        .eq('id', existing.id);
      if (error) {
        console.error('error. failed to update Jira settings:', error.message);
        throw new Error(`Database update failed: ${error.message}`);
      }
    } else {
      const { error } = await supabase
        .from('jira_settings')
        .insert({ jira_url: url, jira_email: email, jira_token: token });
      if (error) {
        console.error('error. failed to insert Jira settings:', error.message);
        throw new Error(`Database insertion failed: ${error.message}`);
      }
    }
  }
}

export const projectsRepository = new ProjectsRepository();
