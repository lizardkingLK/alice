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

    this.notifyMentionedUsers(actorId, created).catch((err) => {
      console.error('Failed to notify mentioned users in createComment:', err);
    });

    return created;
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

    const editorId = actorId || updated.author_id;
    this.notifyMentionedUsers(editorId, updated).catch((err) => {
      console.error('Failed to notify mentioned users in updateComment:', err);
    });

    return updated;
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
