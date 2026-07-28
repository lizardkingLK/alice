/* eslint-disable no-unused-vars */
import type { Tables } from '@repo/types';

export type CommentUser = Pick<Tables<'users'>, 'id' | 'name' | 'email'> &
  Partial<Pick<Tables<'users'>, 'role' | 'profile_picture'>>;

export type CommentWorkItem = Pick<Tables<'work_items'>, 'id' | 'title' | 'type'> & {
  key?: string;
  project?: Pick<Tables<'projects'>, 'id' | 'name' | 'key'> | null;
};

/** Row shape returned by the comments dropdown work-items query. */
export type CommentWorkItemOptionRow = Pick<
  Tables<'work_items'>,
  'id' | 'title' | 'type' | 'project_id'
> & {
  project?: Pick<Tables<'projects'>, 'name' | 'key'> | null;
};

/** Mapped work-item option passed into `CommentsFeed`. */
export type CommentWorkItemOption = Pick<
  Tables<'work_items'>,
  'id' | 'title' | 'type' | 'project_id'
> & {
  key: string;
  project_name?: string;
};

export function mapCommentWorkItemOption(
  row: CommentWorkItemOptionRow
): CommentWorkItemOption {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    project_id: row.project_id,
    key: `${row.project?.key || 'ITEM'}-${row.id.slice(0, 4).toUpperCase()}`,
    project_name: row.project?.name || 'Project',
  };
}

export type CommentItem = Pick<
  Tables<'comments'>,
  | 'id'
  | 'work_item_id'
  | 'author_id'
  | 'parent_id'
  | 'content'
  | 'edited'
  | 'status'
  | 'created_at'
  | 'updated_at'
> & {
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

    async archiveComment(id: string, permanent?: boolean): Promise<void> {
      let url = `${apiComments}/${id}`;
      if (permanent) {
        url += `?permanent=true`;
      }
      await apiFetch(url, {
        method: 'DELETE',
      });
    },

    async restoreComment(id: string): Promise<void> {
      await apiFetch(`${apiComments}/${id}/restore`, {
        method: 'POST',
      });
    },
  };
}
