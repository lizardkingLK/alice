/* eslint-disable no-unused-vars */

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

export function createCommentsService(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  const apiComments = '/api/comments';

  return {
    async getCommentsList(workItemId?: string): Promise<CommentItem[]> {
      let url = apiComments;
      if (workItemId) {
        url += `?work_item_id=${encodeURIComponent(workItemId)}`;
      }
      const data = await apiFetch<{ comments: CommentItem[] }>(url);
      return data.comments;
    },

    async createComment(input: CreateCommentInput): Promise<CommentItem> {
      const data = await apiFetch<{ comment: CommentItem }>(apiComments, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return data.comment;
    },

    async updateComment(id: string, content: string): Promise<CommentItem> {
      const data = await apiFetch<{ comment: CommentItem }>(
        `${apiComments}/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ content }),
        }
      );
      return data.comment;
    },

    async archiveComment(id: string): Promise<void> {
      await apiFetch(`${apiComments}/${id}`, {
        method: 'DELETE',
      });
    },
  };
}
