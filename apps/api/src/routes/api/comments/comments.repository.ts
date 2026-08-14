import {
  USER_PROJECTION_WITH_ROLE,
  projectRelationSelect,
  userRelationSelect,
  type Json,
} from '@repo/types';
import { Prisma, RecordStatus } from '@repo/types/prisma';
import { supabase } from '../../../lib/supabase';
import { prisma } from '../../../lib/prisma';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';
import { prismaLockTimestamp } from '../../../lib/prisma-audit';

export type CommentRow = {
  id: string;
  work_item_id: string;
  author_id: string;
  parent_id: string | null;
  content: Json;
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

  /** Narrow projection for optimistic-lock conflict payloads (no joined PII). */
  private async getLockSnapshotById(
    id: string
  ): Promise<{ id: string; status: string; updated_at: string } | null> {
    const { data, error } = await supabase
      .from('comments')
      .select('id, status, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('error. failed to load comment status:', error.message);
      throw new Error('Failed to retrieve comment');
    }

    return data;
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

    const row = await this.getById(created.id);
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
      fetchUpdated: () => this.getById(id),
      fetchCurrent: () => this.getById(id),
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
}

export const commentsRepository = new CommentsRepository();
