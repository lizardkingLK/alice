import { supabase } from '../../../lib/supabase';

export type CommentRow = {
  id: string;
  work_item_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  edited: boolean;
  status: 'active' | 'archived' | 'deleted';
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export class CommentsRepository {
  async listAll(): Promise<CommentRow[]> {
    const { data, error } = await supabase
      .from('comments')
      .select(
        `
        *,
        author:users!comments_author_id_fkey(id, name, email, role, profile_picture),
        work_item:work_items(id, title, type, project:projects(id, name, key))
      `
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('database error list all comments:', error.message);
      throw new Error('Failed to retrieve comments list');
    }

    return (data || []) as unknown as CommentRow[];
  }

  async create(input: {
    work_item_id: string;
    content: string;
    author_id: string;
    parent_id?: string | null;
  }): Promise<CommentRow> {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        work_item_id: input.work_item_id,
        content: input.content,
        author_id: input.author_id,
        parent_id: input.parent_id || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .select(
        `
        *,
        author:users!comments_author_id_fkey(id, name, email, role, profile_picture),
        work_item:work_items(id, title, type, project:projects(id, name, key))
      `
      )
      .single();

    if (error) {
      console.error('database error create comment:', error.message);
      throw new Error(`Failed to create comment: ${error.message}`);
    }

    return data as unknown as CommentRow;
  }

  async update(id: string, content: string): Promise<CommentRow> {
    const { data, error } = await supabase
      .from('comments')
      .update({
        content,
        edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        `
        *,
        author:users!comments_author_id_fkey(id, name, email, role, profile_picture),
        work_item:work_items(id, title, type, project:projects(id, name, key))
      `
      )
      .single();

    if (error) {
      console.error('database error update comment:', error.message);
      throw new Error(`Failed to update comment: ${error.message}`);
    }

    return data as unknown as CommentRow;
  }

  async archive(id: string): Promise<void> {
    const { error } = await supabase
      .from('comments')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('database error archive comment:', error.message);
      throw new Error(`Failed to archive comment: ${error.message}`);
    }
  }
}

export const commentsRepository = new CommentsRepository();
