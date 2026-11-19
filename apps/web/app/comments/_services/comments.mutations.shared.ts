import {
  commentContentToPlainText,
  jiraIssueKeyFromPmExternal,
  type Json,
  type Tables,
} from '@repo/types';
import type { DestructiveActionAccepted } from '@/lib/api/destructive-action-accepted';
import { forceOptimisticPatch } from '@/lib/optimistic-lock/force-patch';
import { ResponseDTO } from '@repo/types/connection';

export type { DestructiveActionAccepted } from '@/lib/api/destructive-action-accepted';

export type CommentUser = Pick<Tables<'users'>, 'id' | 'name' | 'email'> &
  Partial<Pick<Tables<'users'>, 'role' | 'profile_picture'>>;

export type CommentWorkItem = Pick<
  Tables<'work_items'>,
  'id' | 'title' | 'type'
> & {
  key?: string;
  slug?: string | null;
  project?: Pick<Tables<'projects'>, 'id' | 'name' | 'key'> | null;
};

/** Row shape returned by the comments dropdown work-items query. */
export type CommentWorkItemOptionRow = Pick<
  Tables<'work_items'>,
  'id' | 'title' | 'type' | 'project_id' | 'pm_external' | 'priority'
> & {
  slug?: string | null;
  description?: Json | null;
  jira_issue_key?: string | null;
  project?: Pick<Tables<'projects'>, 'name' | 'key'> | null;
  assignee?: Pick<Tables<'users'>, 'id' | 'name' | 'profile_picture'> | null;
};

/** Mapped work-item option passed into `CommentsFeed`. */
export type CommentWorkItemOption = Pick<
  Tables<'work_items'>,
  'id' | 'title' | 'type' | 'project_id'
> & {
  key: string;
  slug?: string | null;
  project_key?: string | null;
  project_name?: string;
  priority?: Tables<'work_items'>['priority'];
  description_plain?: string;
  assignee_name?: string | null;
  assignee_profile_picture?: string | null;
};

export function mapCommentWorkItemOption(
  row: CommentWorkItemOptionRow
): CommentWorkItemOption {
  const issueKey =
    row.jira_issue_key?.trim() ||
    jiraIssueKeyFromPmExternal(row.pm_external)?.trim();
  const plain = commentContentToPlainText(row.description ?? null).trim();
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    project_id: row.project_id,
    key:
      issueKey ||
      `${row.project?.key || 'ITEM'}-${row.id.slice(0, 4).toUpperCase()}`,
    slug: row.slug ?? null,
    project_key: row.project?.key ?? null,
    project_name: row.project?.name || 'Project',
    priority: row.priority,
    description_plain: plain.length > 0 ? plain.slice(0, 160) : undefined,
    assignee_name: row.assignee?.name ?? null,
    assignee_profile_picture: row.assignee?.profile_picture ?? null,
  };
}

/** Shared comments table columns for feed items and realtime postgres rows. */
export type CommentRowFields = Pick<
  Tables<'comments'>,
  | 'id'
  | 'work_item_id'
  | 'author_id'
  | 'parent_id'
  | 'content'
  | 'reactions'
  | 'edited'
  | 'status'
  | 'created_at'
  | 'updated_at'
>;

export type CommentItem = CommentRowFields & {
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

/* eslint-disable no-unused-vars */
export function createCommentsService(
  apiFetch: <T>(
    path: string,
    init?: RequestInit & { skipDatabaseBusyRetry?: boolean }
  ) => Promise<T>
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

    /** Fire-and-forget archive/purge — API returns 202; inbox notifies when done. */
    async archiveComment(
      id: string,
      expectedUpdatedAt: string,
      permanent?: boolean
    ): Promise<DestructiveActionAccepted> {
      let url = `${apiComments}/${id}`;
      if (permanent) {
        url += `?permanent=true`;
      }
      return await apiFetch<DestructiveActionAccepted>(url, {
        method: 'DELETE',
        body: permanent ? undefined : JSON.stringify({ expectedUpdatedAt }),
        skipDatabaseBusyRetry: true,
      });
    },

    async restoreComment(id: string, expectedUpdatedAt: string): Promise<void> {
      await apiFetch(`${apiComments}/${id}/restore`, {
        method: 'POST',
        body: JSON.stringify({ expectedUpdatedAt }),
      });
    },

    async toggleCommentReaction(
      id: string,
      emoji: string,
      action: 'add' | 'remove',
      options?: { keepalive?: boolean }
    ): Promise<CommentItem> {
      const res = await apiFetch<ResponseDTO<CommentItem>>(
        `${apiComments}/${id}/reactions`,
        {
          method: 'POST',
          body: JSON.stringify({ emoji, action }),
          ...(options?.keepalive === true ? { keepalive: true } : {}),
        }
      );
      return res.data!;
    },
  };
}
