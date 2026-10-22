import {
  Database,
  USER_PROJECTION_WITH_ROLE,
  projectRelationSelect,
  userRelationSelect,
  type Json,
  commentListSelect,
  commentDetailSelect,
  commentAuthorSelect,
  commentWorkItemSelect,
  type CommentListRow,
  type CommentDetailRow,
  type CommentReactionEmoji,
  mergeCommentReaction,
  paginationMeta,
} from '@repo/types';
import { Prisma, RecordStatus } from '@repo/types/prisma';
import { prisma } from '../../../lib/prisma';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';
import { prismaLockTimestamp } from '../../../lib/prisma-audit';
import { SupabaseClient } from '@supabase/supabase-js';
import { listAccessibleProjectIds } from '../../../lib/project-access';
import { CommentAccessError } from './comments.errors';

export type CommentRow = {
  id: string;
  work_item_id: string;
  author_id: string;
  parent_id: string | null;
  content: Json;
  reactions: Json;
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

const commentMutationSelect = {
  id: true,
  work_item_id: true,
  author_id: true,
  parent_id: true,
  content: true,
  reactions: true,
  edited: true,
  status: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
  author: { select: commentAuthorSelect },
  work_item: { select: commentWorkItemSelect },
} as const;

export class CommentsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async getById(id: string): Promise<CommentRow | null> {
    const { data, error } = await this.db
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

  /** Post-mutation / optimistic-lock row via Prisma (no PostgREST hop). */
  async getMutationRowById(id: string): Promise<CommentRow | null> {
    try {
      const row = await prisma.comments.findUnique({
        where: { id },
        select: commentMutationSelect,
      });
      if (!row) {
        return null;
      }
      return {
        ...row,
        content: row.content as Json,
        reactions: row.reactions as Json,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
      } as unknown as CommentRow;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to get comment mutation row:', message);
      throw new Error('Failed to retrieve comment');
    }
  }

  /** Narrow projection for optimistic-lock conflict payloads (no joined PII). */
  private async getLockSnapshotById(
    id: string
  ): Promise<{ id: string; status: string; updated_at: string } | null> {
    try {
      const row = await prisma.comments.findUnique({
        where: { id },
        select: { id: true, status: true, updated_at: true },
      });
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        status: row.status,
        updated_at: row.updated_at.toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to load comment status:', message);
      throw new Error('Failed to retrieve comment');
    }
  }

  async create(input: {
    work_item_id: string;
    content: Json;
    author_id: string;
    parent_id?: string | null;
  }): Promise<CommentRow> {
    const created = await prisma.comments.create({
      data: {
        work_item_id: input.work_item_id,
        content: input.content as Prisma.InputJsonValue,
        author_id: input.author_id,
        parent_id: input.parent_id || null,
        status: RecordStatus.active,
      },
    });

    const row = await this.getMutationRowById(created.id);
    if (!row) {
      throw new Error('Failed to create comment');
    }
    return row;
  }

  async update(
    id: string,
    content: Json,
    expectedUpdatedAt: string
  ): Promise<CommentRow> {
    const { count } = await prisma.comments.updateMany({
      where: { id, updated_at: prismaLockTimestamp(expectedUpdatedAt) },
      data: {
        content: content as Prisma.InputJsonValue,
        edited: true,
        updated_at: new Date(),
      },
    });

    return resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.getMutationRowById(id),
      fetchCurrent: () => this.getMutationRowById(id),
      notFoundMessage: 'Comment not found',
    });
  }

  async archive(id: string, expectedUpdatedAt: string): Promise<void> {
    await this.setStatus(id, 'archived', expectedUpdatedAt);
  }

  async restore(id: string, expectedUpdatedAt: string): Promise<void> {
    await this.setStatus(id, 'active', expectedUpdatedAt);
  }

  private async setStatus(
    id: string,
    status: 'archived' | 'active',
    expectedUpdatedAt: string
  ): Promise<void> {
    const { count } = await prisma.comments.updateMany({
      where: { id, updated_at: prismaLockTimestamp(expectedUpdatedAt) },
      data: { status, updated_at: new Date() },
    });

    await resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.getLockSnapshotById(id),
      fetchCurrent: () => this.getLockSnapshotById(id),
      notFoundMessage: 'Comment not found',
    });
  }

  async hardDelete(id: string): Promise<void> {
    await prisma.comments.deleteMany({ where: { id } });
  }

  /**
   * Merge one user+emoji intent into reactions JSONB.
   * Uses Prisma update (not interactive FOR UPDATE / $queryRaw) so we avoid
   * Postgres `unknown`-param plan errors from tagged raw SQL. Same-user spam
   * is serialized by the web reaction queue; multi-user merges stay idempotent
   * per pair via mergeCommentReaction.
   */
  async mergeReaction(
    id: string,
    userId: string,
    emoji: CommentReactionEmoji,
    action: 'add' | 'remove'
  ): Promise<CommentRow> {
    try {
      const current = await prisma.comments.findUnique({
        where: { id },
        select: { reactions: true },
      });
      if (!current) {
        throw new Error('Comment not found');
      }

      const next = mergeCommentReaction(
        current.reactions,
        userId,
        emoji,
        action
      );

      const { count } = await prisma.comments.updateMany({
        where: { id },
        data: {
          reactions: next as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });
      if (count === 0) {
        throw new Error('Comment not found');
      }

      const row = await this.getMutationRowById(id);
      if (!row) {
        throw new Error('Comment not found');
      }
      return row;
    } catch (error) {
      if (error instanceof Error && error.message === 'Comment not found') {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to merge comment reaction:', message, {
        commentId: id,
        userId,
        emoji,
        action,
      });
      throw new Error('Failed to update comment reaction');
    }
  }

  async listAccessibleProjectIds(actorId: string): Promise<string[]> {
    return listAccessibleProjectIds(this.db, actorId);
  }

  async assertCanAccessProject(
    actorId: string,
    projectId: string
  ): Promise<void> {
    const accessible = await this.listAccessibleProjectIds(actorId);
    if (!accessible.includes(projectId)) {
      throw new CommentAccessError();
    }
  }

  async requireProjectMember(
    commentId: string,
    actorId: string
  ): Promise<{ projectId: string }> {
    const { data: comment, error } = await this.db
      .from('comments')
      .select('work_items(project_id)')
      .eq('id', commentId)
      .maybeSingle();

    if (error) {
      console.error(
        'error. failed to load comment for project access:',
        error.message
      );
      throw new Error('Failed to authorize comment access');
    }

    if (!comment?.work_items) {
      throw new Error('Comment not found');
    }

    const projectId = (comment.work_items as unknown as { project_id: string })
      .project_id;
    await this.assertCanAccessProject(actorId, projectId);
    return { projectId };
  }

  async requireWorkItemProjectMember(
    workItemId: string,
    actorId: string
  ): Promise<{ projectId: string }> {
    const { data: workItem, error } = await this.db
      .from('work_items')
      .select('project_id')
      .eq('id', workItemId)
      .maybeSingle();

    if (error) {
      console.error(
        'error. failed to load work-item for project access:',
        error.message
      );
      throw new Error('Failed to authorize comment access');
    }

    if (!workItem) {
      throw new Error('Work item not found');
    }

    await this.assertCanAccessProject(actorId, workItem.project_id);
    return { projectId: workItem.project_id };
  }

  async listPaginated(input: {
    filters?: {
      workItemId?: string;
      projectIds?: string[];
      projectId?: string;
    };
    page: number;
    limit: number;
  }): Promise<{
    comments: CommentListRow[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (input.page - 1) * input.limit;
    const take = input.limit;
    const where: Prisma.commentsWhereInput = {};

    if (input.filters?.workItemId) {
      where.work_item_id = input.filters.workItemId;
    }

    if (input.filters?.projectId) {
      where.work_item = {
        project_id: input.filters.projectId,
      };
    } else if (input.filters?.projectIds) {
      where.work_item = {
        project_id: { in: input.filters.projectIds },
      };
    }

    try {
      const [comments, totalCount] = await Promise.all([
        prisma.comments.findMany({
          where,
          select: commentListSelect,
          orderBy: { created_at: 'desc' },
          skip,
          take,
        }),
        prisma.comments.count({ where }),
      ]);

      return {
        comments,
        ...paginationMeta(totalCount, input.page, input.limit),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to list comments:', message);
      throw new Error('Failed to list comments');
    }
  }

  async getDetailById(commentId: string): Promise<CommentDetailRow | null> {
    try {
      return await prisma.comments.findUnique({
        where: { id: commentId },
        select: commentDetailSelect,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to get comment detail:', message);
      throw new Error('Failed to get comment');
    }
  }
}
