/* eslint-disable no-unused-vars */
import { createClient } from '@/lib/supabase/client';

export type CommentUser = {
  id: string;
  name: string;
  email: string;
  role?: string;
  profile_picture?: string | null;
};

export type CommentWorkItem = {
  id: string;
  title: string;
  key?: string;
  type: string;
  project?: {
    id: string;
    name: string;
    key: string;
  } | null;
};

export type CommentItem = {
  id: string;
  work_item_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  edited: boolean;
  status: 'active' | 'archived' | 'deleted';
  created_at: string;
  updated_at: string;
  author?: CommentUser | null;
  work_item?: CommentWorkItem | null;
  replies?: CommentItem[];
};

export type CreateCommentInput = {
  work_item_id: string;
  content: string;
  author_id: string;
  parent_id?: string | null;
};

type DbCommentRaw = CommentItem & {
  work_item?: {
    id: string;
    title: string;
    type: string;
    project?: { id: string; name: string; key: string } | null;
  } | null;
};

const COMMENT_SELECT_FIELDS = `
  *,
  author:users!comments_author_id_fkey(id, name, email, role, profile_picture),
  work_item:work_items(id, title, type, project:projects(id, name, key))
`;

function mapDbCommentToCommentItem(data: unknown): CommentItem {
  const raw = data as DbCommentRaw;
  const projectKey = raw.work_item?.project?.key || 'ITEM';
  const computedKey = raw.work_item ? `${projectKey}-${raw.work_item.id.slice(0, 4).toUpperCase()}` : '';

  return {
    ...raw,
    work_item: raw.work_item
      ? {
          ...raw.work_item,
          key: computedKey,
        }
      : null,
  } as CommentItem;
}

async function createCommentDirect(input: CreateCommentInput): Promise<CommentItem> {
  const supabase = createClient();
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
    .select(COMMENT_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Failed to create comment: ${error.message}`);
  }

  return mapDbCommentToCommentItem(data);
}

async function updateCommentDirect(id: string, content: string): Promise<CommentItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('comments')
    .update({
      content,
      edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(COMMENT_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Failed to update comment: ${error.message}`);
  }

  return mapDbCommentToCommentItem(data);
}

async function archiveCommentDirect(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('comments')
    .update({
      status: 'archived',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to archive comment: ${error.message}`);
  }
}

export function createCommentsService(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  const apiComments = '/api/comments';

  return {
    async getCommentsList(): Promise<CommentItem[]> {
      try {
        const data = await apiFetch<{ comments: CommentItem[] }>(apiComments);
        return data.comments;
      } catch (error) {
        console.warn('API getCommentsList failed, using direct client fallback:', error);
        const supabase = createClient();
        const { data } = await supabase
          .from('comments')
          .select(COMMENT_SELECT_FIELDS)
          .order('created_at', { ascending: false });
        return (data || []) as unknown as CommentItem[];
      }
    },

    async createComment(input: CreateCommentInput): Promise<CommentItem> {
      try {
        const data = await apiFetch<{ comment: CommentItem }>(apiComments, {
          method: 'POST',
          body: JSON.stringify(input),
        });
        return data.comment;
      } catch (error) {
        console.warn('API createComment failed, using direct client fallback:', error);
        return await createCommentDirect(input);
      }
    },

    async updateComment(id: string, content: string): Promise<CommentItem> {
      try {
        const data = await apiFetch<{ comment: CommentItem }>(`${apiComments}/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ content }),
        });
        return data.comment;
      } catch (error) {
        console.warn('API updateComment failed, using direct client fallback:', error);
        return await updateCommentDirect(id, content);
      }
    },

    async archiveComment(id: string): Promise<void> {
      try {
        await apiFetch(`${apiComments}/${id}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.warn('API archiveComment failed, using direct client fallback:', error);
        await archiveCommentDirect(id);
      }
    },
  };
}
