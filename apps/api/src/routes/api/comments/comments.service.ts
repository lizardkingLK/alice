import {
  type Json,
  type ListCommentsQuery,
  type CommentListRow,
  type CommentDetailRow,
  paginationMeta,
} from '@repo/types';
import { CommentsRepository, type CommentRow } from './comments.repository';
import type { NotificationsService } from '../notifications/notifications.service';
import {
  extractMentionedUserIds,
  createCommentSnippet,
} from './comments.utils';

import { UserRoleEnum } from '@repo/types';
import { RecordStatus } from '@repo/types/prisma';
import { prisma } from '../../../lib/prisma';

export class CommentsService {
  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly notificationsService: Pick<
      NotificationsService,
      'createMentionNotification'
    >
  ) {}

  private async getAllowedMentionUserIds(
    workItemId: string
  ): Promise<Set<string>> {
    try {
      const workItem = await prisma.work_items.findUnique({
        where: { id: workItemId },
        select: { project_id: true },
      });

      if (!workItem?.project_id) {
        return new Set();
      }

      const [project, members, admins] = await Promise.all([
        prisma.projects.findUnique({
          where: { id: workItem.project_id },
          select: { owner_id: true },
        }),
        prisma.project_members.findMany({
          where: {
            project_id: workItem.project_id,
            status: RecordStatus.active,
          },
          select: { user_id: true },
        }),
        prisma.users.findMany({
          where: { role: UserRoleEnum.admin, status: RecordStatus.active },
          select: { id: true },
        }),
      ]);

      const allowed = new Set<string>();
      if (project?.owner_id) {
        allowed.add(project.owner_id);
      }
      for (const m of members) {
        if (m.user_id) allowed.add(m.user_id);
      }
      for (const a of admins) {
        if (a.id) allowed.add(a.id);
      }

      return allowed;
    } catch (error) {
      console.error('Failed to resolve allowed mention user IDs:', error);
      return new Set();
    }
  }

  /**
   * Await mention inserts so Vercel does not freeze the isolate before Prisma
   * commits. Realtime postgres_changes reads WAL only after commit.
   */
  private async notifyMentionedUsers(
    actorId: string,
    comment: CommentRow
  ): Promise<void> {
    const mentionedUserIds = extractMentionedUserIds(
      comment.content,
      actorId
    ).filter((id) => id !== actorId);

    if (!mentionedUserIds.length) {
      return;
    }

    const allowedUserIds = await this.getAllowedMentionUserIds(
      comment.work_item_id
    );
    const validMentionedUserIds = mentionedUserIds.filter((id) =>
      allowedUserIds.has(id)
    );

    if (!validMentionedUserIds.length) {
      return;
    }

    const snippet = createCommentSnippet(comment.content);

    try {
      for (const userId of validMentionedUserIds) {
        await this.notificationsService.createMentionNotification({
          mentionedUserId: userId,
          actorId,
          taskTitle: 'work item',
          taskId: comment.work_item_id,
          commentContentSnippet: snippet,
        });
      }
    } catch (error) {
      console.error('Failed to send mention notification:', error);
    }
  }

  private async notifyMentionsAndReturn(
    actorId: string,
    comment: CommentRow
  ): Promise<CommentRow> {
    await this.notifyMentionedUsers(actorId, comment);
    return comment;
  }

  async createComment(
    actorId: string,
    input: {
      work_item_id: string;
      content: Json;
      parent_id?: string | null;
    }
  ): Promise<CommentRow> {
    const created = await this.commentsRepository.create({
      ...input,
      author_id: actorId,
    });

    return this.notifyMentionsAndReturn(actorId, created);
  }

  async updateComment(
    id: string,
    content: Json,
    expectedUpdatedAt: string,
    actorId?: string
  ): Promise<CommentRow> {
    const updated = await this.commentsRepository.update(
      id,
      content,
      expectedUpdatedAt
    );

    return this.notifyMentionsAndReturn(actorId || updated.author_id, updated);
  }

  async archiveComment(id: string, expectedUpdatedAt: string): Promise<void> {
    await this.commentsRepository.archive(id, expectedUpdatedAt);
  }

  async restoreComment(id: string, expectedUpdatedAt: string): Promise<void> {
    await this.commentsRepository.restore(id, expectedUpdatedAt);
  }

  async hardDeleteComment(id: string): Promise<void> {
    await this.commentsRepository.hardDelete(id);
  }

  async listCommentsPaginated(
    query: ListCommentsQuery,
    actorId: string
  ): Promise<{
    comments: CommentListRow[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const accessible =
      await this.commentsRepository.listAccessibleProjectIds(actorId);

    if (accessible.length === 0) {
      return {
        comments: [],
        ...paginationMeta(0, query.page, query.limit),
      };
    }

    if (query.workItemId) {
      await this.commentsRepository.requireWorkItemProjectMember(
        query.workItemId,
        actorId
      );
    }

    const filters = {
      workItemId: query.workItemId,
      projectIds: accessible,
    };

    return await this.commentsRepository.listPaginated({
      filters,
      page: query.page,
      limit: query.limit,
    });
  }

  async getCommentDetail(
    commentId: string,
    actorId: string
  ): Promise<CommentDetailRow | null> {
    await this.commentsRepository.requireProjectMember(commentId, actorId);
    return await this.commentsRepository.getDetailById(commentId);
  }
}
