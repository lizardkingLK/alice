import {
  USER_PROJECTION_WITH_ROLE,
  projectRelationSelect,
  userRelationSelect,
} from '@repo/types';
import { supabase } from '../../../lib/supabase';
import { resolveOptimisticUpdate } from '../../../lib/optimistic-lock';

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

const COMMENT_AUTHOR_SELECT = userRelationSelect(
  'author',
  'comments_author_id_fkey',
  USER_PROJECTION_WITH_ROLE
);

const COMMENT_WITH_RELATIONS = `
        *,
        ${COMMENT_AUTHOR_SELECT},
        work_item:work_items(id, title, type, ${projectRelationSelect()})
      `;

export class CommentsRepository {
  async getById(id: string): Promise<CommentRow | null> {
    const { data, error } = await supabase
      .from('comments')
      .select(COMMENT_WITH_RELATIONS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('database error get comment:', error.message);
      throw new Error('Failed to retrieve comment');
    }

    return data as unknown as CommentRow | null;
  }

  async listAll(workItemId?: string): Promise<CommentRow[]> {
    let query = supabase.from('comments').select(COMMENT_WITH_RELATIONS);

    if (workItemId) {
      query = query.eq('work_item_id', workItemId);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

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
      .select(COMMENT_WITH_RELATIONS)
      .single();

    if (error) {
      console.error('database error create comment:', error.message);
      throw new Error(`Failed to create comment: ${error.message}`);
    }

    return data as unknown as CommentRow;
  }

  async update(
    id: string,
    content: string,
    expectedUpdatedAt: string
  ): Promise<CommentRow> {
    const { data, error } = await supabase
      .from('comments')
      .update({
        content,
        edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('updated_at', expectedUpdatedAt)
      .select(COMMENT_WITH_RELATIONS)
      .maybeSingle();

    return (await resolveOptimisticUpdate({
      data: data as unknown as CommentRow | null,
      error,
      fetchCurrent: () => this.getById(id),
      notFoundMessage: 'Comment not found',
    })) as CommentRow;
  }

  async archive(id: string, expectedUpdatedAt: string): Promise<void> {
    const { data, error } = await supabase
      .from('comments')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('updated_at', expectedUpdatedAt)
      .select('id')
      .maybeSingle();

    await resolveOptimisticUpdate({
      data,
      error,
      fetchCurrent: () => this.getById(id),
      notFoundMessage: 'Comment not found',
    });
  }

  async restore(id: string, expectedUpdatedAt: string): Promise<void> {
    const { data, error } = await supabase
      .from('comments')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('updated_at', expectedUpdatedAt)
      .select('id')
      .maybeSingle();

    await resolveOptimisticUpdate({
      data,
      error,
      fetchCurrent: () => this.getById(id),
      notFoundMessage: 'Comment not found',
    });
  }

  async hardDelete(id: string): Promise<void> {
    const { error } = await supabase.from('comments').delete().eq('id', id);

    if (error) {
      console.error('database error hard delete comment:', error.message);
      throw new Error(`Failed to delete comment: ${error.message}`);
    }
  }
}

export const commentsRepository = new CommentsRepository();
