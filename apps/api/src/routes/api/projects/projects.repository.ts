import { supabase } from '../../../lib/supabase';
import { auditCreateWithoutStatus, auditUpdate } from '../../../lib/audit';

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
};

export type ProjectRowWithOwner = ProjectRow & {
  owner?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

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

  async findById(id: string): Promise<ProjectRow | null> {
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
    if (error) {
      console.error('error. failed to find project by id:', error.message);
      throw new Error('Failed to find project');
    }
    return data;
  }

  async create(data: Omit<ProjectRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>, actorId: string): Promise<ProjectRow> {
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

  async update(id: string, data: Partial<Omit<ProjectRow, 'id' | 'created_at' | 'updated_at'>>, actorId: string): Promise<ProjectRow> {
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
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('error. failed to delete project:', error.message);
      throw new Error(`Database delete failed: ${error.message}`);
    }
  }
}

export const projectsRepository = new ProjectsRepository();
