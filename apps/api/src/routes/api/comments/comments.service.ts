import { commentsRepository, type CommentRow } from './comments.repository';
import { notificationsService } from '../notifications/notifications.service';
import {
  extractMentionedUserIds,
  createCommentSnippet,
} from './comments.utils';


export class CommentsService {
  async listComments(workItemId?: string): Promise<CommentRow[]> {
    return await commentsRepository.listAll(workItemId);
  }

  private async notifyMentionedUsers(
    actorId: string,
    comment: CommentRow
  ): Promise<void> {

    const mentionedUserIds = extractMentionedUserIds(
      comment.content,
      actorId
    )
    .filter(id => id !== actorId);


    if (!mentionedUserIds.length) {
      return;
    }


    const snippet = createCommentSnippet(
      comment.content
    );


    try {

      for (const userId of mentionedUserIds) {

        await notificationsService.createMentionNotification({
          mentionedUserId: userId,
          actorId,
          taskTitle: 'work item',
          taskId: comment.work_item_id,
          commentContentSnippet: snippet,
        });

      }

    } catch(error) {

      console.error(
        'Failed to send mention notification:',
        error
      );

    }
  }

  async createComment(
    actorId: string,
    input: {
      work_item_id: string;
      content: string;
      parent_id?: string | null;
    }
  ): Promise<CommentRow> {
    const created = await commentsRepository.create({
      ...input,
      author_id: actorId,
    });
    
    this.notifyMentionedUsers(actorId, created).catch((err) => {
      console.error('Failed to notify mentioned users in createComment:', err);
    });

    return created;
  }

  async updateComment(id: string, content: string, actorId?: string): Promise<CommentRow> {
    const updated = await commentsRepository.update(id, content);
    
    
    const editorId = actorId || updated.author_id;
    this.notifyMentionedUsers(editorId, updated).catch((err) => {
      console.error('Failed to notify mentioned users in updateComment:', err);
    });

    return updated;
  }

  async archiveComment(id: string): Promise<void> {
    await commentsRepository.archive(id);
  }
}

export const commentsService = new CommentsService();
