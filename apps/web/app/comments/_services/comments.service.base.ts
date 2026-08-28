/* eslint-disable no-unused-vars */
import type { Json, Tables } from '@repo/types';
import { forceOptimisticPatch } from '@/lib/optimistic-lock/force-patch';
import { ResponseDTO } from '@repo/types/connection';

export type CommentUser = Pick<Tables<'users'>, 'id' | 'name' | 'email'> &
  Partial<Pick<Tables<'users'>, 'role' | 'profile_picture'>>;

export type CommentWorkItem = Pick<
  Tables<'work_items'>,
  'id' | 'title' | 'type'
> & {
  key?: string;
  project?: Pick<Tables<'projects'>, 'id' | 'name' | 'key'> | null;
};

/** Row shape returned by the comments dropdown work-items query. */
export type CommentWorkItemOptionRow = Pick<
  Tables<'work_items'>,
  'id' | 'title' | 'type' | 'project_id' | 'jira_issue_key'
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
  const issueKey = row.jira_issue_key?.trim();
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    project_id: row.project_id,
    key:
      issueKey ||
      `${row.project?.key || 'ITEM'}-${row.id.slice(0, 4).toUpperCase()}`,
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
  content: Json;
  author_id: string;
  parent_id?: string | null;
};

export function createCommentsService(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  const apiComments = '/api/comments';

  return {
    async createComment(input: CreateCommentInput): Promise<CommentItem> {
      const res = await apiFetch<ResponseDTO<CommentItem>>(apiComments, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data!;
    },

    async updateComment(
      id: string,
      content: Json,
      expectedUpdatedAt: string
    ): Promise<CommentItem> {
      const res = await apiFetch<ResponseDTO<CommentItem>>(
        `${apiComments}/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ content, expectedUpdatedAt }),
        }
      );
      return res.data!;
    },

    /** Force-apply pending fields after a user confirms Keep mine / merge. */
    async forceUpdateComment(
      id: string,
      pendingFields: Record<string, unknown>,
      expectedUpdatedAt: string
    ): Promise<CommentItem> {
      const res = await forceOptimisticPatch<ResponseDTO<CommentItem>>(
        apiFetch,
        `${apiComments}/${id}`,
        { pendingFields, expectedUpdatedAt, method: 'PATCH' }
      );
      return res.data!;
    },

    async archiveComment(
      id: string,
      expectedUpdatedAt: string,
      permanent?: boolean
    ): Promise<void> {
      let url = `${apiComments}/${id}`;
      if (permanent) {
        url += `?permanent=true`;
      }
      await apiFetch(url, {
        method: 'DELETE',
        body: permanent ? undefined : JSON.stringify({ expectedUpdatedAt }),
      });
    },

    async restoreComment(id: string, expectedUpdatedAt: string): Promise<void> {
      await apiFetch(`${apiComments}/${id}/restore`, {
        method: 'POST',
        body: JSON.stringify({ expectedUpdatedAt }),
      });
    },
  };
}
