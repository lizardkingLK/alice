import { supabase } from '../../../lib/supabase';
import { auditCreate, auditUpdate } from '../../../lib/audit';

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
};

export class UsersRepository {
  async listAll(): Promise<UserRow[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('error. failed to list users:', error.message);
      throw new Error('Failed to list users');
    }

    return data as UserRow[];
  }

  async listPaginated(
    page: number,
    limit: number
  ): Promise<{ users: UserRow[]; totalCount: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('error. failed to list users paginated:', error.message);
      throw new Error('Failed to list users');
    }

    return {
      users: (data as UserRow[]) ?? [],
      totalCount: count ?? 0,
    };
  }

  async findById(id: string): Promise<UserRow | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('error. failed to find user by id:', error.message);
      throw new Error('Failed to find user');
    }

    return data as UserRow | null;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('error. failed to find user by email:', error.message);
      throw new Error('Failed to find user by email');
    }

    return data as UserRow | null;
  }

  async create(
    data: Pick<UserRow, 'id' | 'name' | 'email' | 'role'>,
    actorId: string
  ): Promise<UserRow> {
    const { data: created, error } = await supabase
      .from('users')
      .insert({
        ...data,
        active: true,
        ...auditCreate(actorId),
      })
      .select()
      .single();

    if (error) {
      console.error(
        'error. failed to create user registry row:',
        error.message
      );
      throw new Error(`Database registration failed: ${error.message}`);
    }

    return created as UserRow;
  }

  async update(
    id: string,
    data: Partial<
      Omit<UserRow, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'email'>
    >,
    actorId: string
  ): Promise<UserRow> {
    const { data: updated, error } = await supabase
      .from('users')
      .update({
        ...data,
        ...auditUpdate(actorId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('error. failed to update user:', error.message);
      throw new Error(`Database update failed: ${error.message}`);
    }

    return updated as UserRow;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('users').delete().eq('id', id);

    if (error) {
      console.error('error. failed to delete user:', error.message);
      throw new Error(`Database delete failed: ${error.message}`);
    }
  }
}

export const usersRepository = new UsersRepository();
