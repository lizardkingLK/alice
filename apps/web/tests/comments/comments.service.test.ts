import { describe, expect, it, vi } from 'vitest';
import { createCommentsService } from '@/app/comments/_services/comments.service.base';
import { commentFactory } from '../factories/comment.factory';
import { plainTextToCommentDoc, toCommentTiptapContent } from '@repo/types';

describe('createCommentsService', () => {
  it('creates a new comment via POST', async () => {
    // Arrange
    const comment = commentFactory.build();
    const apiFetch = vi.fn().mockResolvedValue({ data: comment, error: null });
    const service = createCommentsService(apiFetch);
    const input = {
      work_item_id: 'wi-1',
      content: plainTextToCommentDoc('Hello world'),
      author_id: 'user-1',
    };

    // Act
    const result = await service.createComment(input);

    // Assert
    expect(apiFetch).toHaveBeenCalledWith('/api/comments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    expect(result).toEqual(comment);
  });

  it('creates a threaded reply comment by passing parent_id', async () => {
    // Arrange
    const replyComment = commentFactory.build({
      id: 'comment-reply-1',
      parent_id: 'comment-parent-1',
      content: plainTextToCommentDoc('This is a threaded reply'),
    });
    const apiFetch = vi.fn().mockResolvedValue({ data: replyComment, error: null });
    const service = createCommentsService(apiFetch);
    const input = {
      work_item_id: 'wi-1',
      content: plainTextToCommentDoc('This is a threaded reply'),
      author_id: 'user-2',
      parent_id: 'comment-parent-1',
    };

    // Act
    const result = await service.createComment(input);

    // Assert
    expect(apiFetch).toHaveBeenCalledWith('/api/comments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    expect(result.parent_id).toBe('comment-parent-1');
    expect(result).toEqual(replyComment);
  });

  it('creates a comment with user and work-item mentions', async () => {
    // Arrange
    const docWithMentions = toCommentTiptapContent(
      'Ping @[Alice Admin](user-admin-1) regarding #[ALICE-1](wi-1)'
    );
    const comment = commentFactory.build({
      content: docWithMentions,
    });
    const apiFetch = vi.fn().mockResolvedValue({ data: comment, error: null });
    const service = createCommentsService(apiFetch);
    const input = {
      work_item_id: 'wi-1',
      content: docWithMentions,
      author_id: 'user-1',
    };

    // Act
    const result = await service.createComment(input);

    // Assert
    expect(apiFetch).toHaveBeenCalledWith('/api/comments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    expect(result.content).toEqual(docWithMentions);
  });

  it('updates comment content via PATCH (Edit)', async () => {
    // Arrange
    const updatedDoc = plainTextToCommentDoc('Updated hello world');
    const comment = commentFactory.build({
      content: updatedDoc,
      edited: true,
    });
    const apiFetch = vi.fn().mockResolvedValue({ data: comment, error: null });
    const service = createCommentsService(apiFetch);
    const expectedUpdatedAt = '2026-08-17T09:00:00.000Z';

    // Act
    const result = await service.updateComment(
      'comment-1',
      updatedDoc,
      expectedUpdatedAt
    );

    // Assert
    expect(apiFetch).toHaveBeenCalledWith('/api/comments/comment-1', {
      method: 'PATCH',
      body: JSON.stringify({
        content: updatedDoc,
        expectedUpdatedAt,
      }),
    });
    expect(result).toEqual(comment);
  });

  it('updates comment content with mentions via PATCH', async () => {
    // Arrange
    const updatedDoc = toCommentTiptapContent(
      'Updated mention to @[Bob Developer](user-dev-1)'
    );
    const comment = commentFactory.build({
      content: updatedDoc,
      edited: true,
    });
    const apiFetch = vi.fn().mockResolvedValue({ data: comment, error: null });
    const service = createCommentsService(apiFetch);
    const expectedUpdatedAt = '2026-08-17T09:00:00.000Z';

    // Act
    const result = await service.updateComment(
      'comment-1',
      updatedDoc,
      expectedUpdatedAt
    );

    // Assert
    expect(apiFetch).toHaveBeenCalledWith('/api/comments/comment-1', {
      method: 'PATCH',
      body: JSON.stringify({
        content: updatedDoc,
        expectedUpdatedAt,
      }),
    });
    expect(result.content).toEqual(updatedDoc);
  });

  it('forces update of a comment (conflict resolution) via PATCH', async () => {
    // Arrange
    const comment = commentFactory.build();
    const apiFetch = vi.fn().mockResolvedValue({ data: comment, error: null });
    const service = createCommentsService(apiFetch);
    const pendingFields = {
      content: plainTextToCommentDoc('Overwritten content'),
    };
    const expectedUpdatedAt = '2026-08-17T09:00:00.000Z';

    // Act
    const result = await service.forceUpdateComment(
      'comment-1',
      pendingFields,
      expectedUpdatedAt
    );

    // Assert
    expect(apiFetch).toHaveBeenCalledWith('/api/comments/comment-1', {
      method: 'PATCH',
      body: JSON.stringify({
        ...pendingFields,
        expectedUpdatedAt,
      }),
    });
    expect(result).toEqual(comment);
  });

  it('soft-deletes (archives) a comment via DELETE', async () => {
    // Arrange
    const apiFetch = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    const service = createCommentsService(apiFetch);
    const expectedUpdatedAt = '2026-08-17T09:00:00.000Z';

    // Act
    await service.archiveComment('comment-1', expectedUpdatedAt);

    // Assert
    expect(apiFetch).toHaveBeenCalledWith('/api/comments/comment-1', {
      method: 'DELETE',
      body: JSON.stringify({ expectedUpdatedAt }),
    });
  });

  it('permanently deletes a comment via DELETE when permanent flag is true', async () => {
    // Arrange
    const apiFetch = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    const service = createCommentsService(apiFetch);
    const expectedUpdatedAt = '2026-08-17T09:00:00.000Z';

    // Act
    await service.archiveComment('comment-1', expectedUpdatedAt, true);

    // Assert
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/comments/comment-1?permanent=true',
      {
        method: 'DELETE',
        body: undefined,
      }
    );
  });

  it('restores a comment via POST', async () => {
    // Arrange
    const apiFetch = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    const service = createCommentsService(apiFetch);
    const expectedUpdatedAt = '2026-08-17T09:00:00.000Z';

    // Act
    await service.restoreComment('comment-1', expectedUpdatedAt);

    // Assert
    expect(apiFetch).toHaveBeenCalledWith('/api/comments/comment-1/restore', {
      method: 'POST',
      body: JSON.stringify({ expectedUpdatedAt }),
    });
  });
});
