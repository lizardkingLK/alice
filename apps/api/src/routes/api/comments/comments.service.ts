import type { Json } from '@repo/types';
import { CommentsRepository, type CommentRow } from './comments.repository';
import type { NotificationsService } from '../notifications/notifications.service';
import {
  extractMentionedUserIds,
  createCommentSnippet,
} from './comments.utils';

export class CommentsService {
  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly notificationsService: Pick<
      NotificationsService,
      'createMentionNotification'
    >
  ) {}

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

    const snippet = createCommentSnippet(comment.content);

    try {
      for (const userId of mentionedUserIds) {
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
}
