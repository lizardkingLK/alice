import { commentsRepository, type CommentRow } from './comments.repository';

export class CommentsService {
  async listComments(workItemId?: string): Promise<CommentRow[]> {
    return await commentsRepository.listAll(workItemId);
  }

  async createComment(
    actorId: string,
    input: {
      work_item_id: string;
      content: string;
      parent_id?: string | null;
    }
  ): Promise<CommentRow> {
    return await commentsRepository.create({
      ...input,
      author_id: actorId,
    });
  }

  async updateComment(id: string, content: string): Promise<CommentRow> {
    return await commentsRepository.update(id, content);
  }

  async archiveComment(id: string): Promise<void> {
    await commentsRepository.archive(id);
  }
}

export const commentsService = new CommentsService();
