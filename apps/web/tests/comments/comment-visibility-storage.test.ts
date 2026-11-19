import { beforeEach, describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/react';
import {
  readHiddenCommentIds,
  writeHiddenCommentIds,
  hideCommentForUser,
  unhideCommentForUser,
  isAiDiscussionComment,
  canUserHideComment,
  filterVisibleComments,
  hiddenCommentsStorageKey,
} from '@/app/comments/_helpers/comment-visibility-storage';
import { commentFactory } from '../factories/comment.factory';

describe('comment-visibility-storage', () => {
  const USER_A = '11111111-1111-4111-8111-111111111111';
  const USER_B = '22222222-2222-4222-8222-222222222222';

  const agentCommentDoc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'mention',
            attrs: {
              id: 'agent:33333333-3333-4333-8333-333333333333',
              label: 'DevBot',
              mentionType: 'agent',
            },
          },
          {
            type: 'text',
            text: ' suggest a title for this item',
          },
        ],
      },
    ],
  };

  const plainCommentDoc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Normal discussion comment' }],
      },
    ],
  };

  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('persistence and user isolation', () => {
    it('returns empty set when userId is missing or storage is empty', () => {
      expect(readHiddenCommentIds(undefined)).toEqual(new Set());
      expect(readHiddenCommentIds(null)).toEqual(new Set());
      expect(readHiddenCommentIds(USER_A)).toEqual(new Set());
    });

    it('writes and reads hidden comment IDs for a user', () => {
      writeHiddenCommentIds(USER_A, ['comment-1', 'comment-2']);
      expect(readHiddenCommentIds(USER_A)).toEqual(
        new Set(['comment-1', 'comment-2'])
      );
    });

    it('adds and removes hidden comment IDs', () => {
      hideCommentForUser(USER_A, 'comment-1');
      hideCommentForUser(USER_A, 'comment-2');
      expect(readHiddenCommentIds(USER_A)).toEqual(
        new Set(['comment-1', 'comment-2'])
      );

      unhideCommentForUser(USER_A, 'comment-1');
      expect(readHiddenCommentIds(USER_A)).toEqual(new Set(['comment-2']));
    });

    it('enforces strict user isolation across storage keys', () => {
      hideCommentForUser(USER_A, 'comment-ai-1');

      // User A has hidden comment-ai-1
      expect(readHiddenCommentIds(USER_A).has('comment-ai-1')).toBe(true);

      // User B has no hidden comments
      expect(readHiddenCommentIds(USER_B).has('comment-ai-1')).toBe(false);
      expect(readHiddenCommentIds(USER_B).size).toBe(0);

      // Distinct storage keys
      expect(hiddenCommentsStorageKey(USER_A)).not.toEqual(
        hiddenCommentsStorageKey(USER_B)
      );
    });

    it('handles corrupted storage gracefully', () => {
      window.localStorage.setItem(
        hiddenCommentsStorageKey(USER_A),
        'invalid-json-content'
      );
      expect(readHiddenCommentIds(USER_A)).toEqual(new Set());
    });
  });

  describe('isAiDiscussionComment', () => {
    it('returns true when comment contains an agent mention', () => {
      const comment = commentFactory.build({ content: agentCommentDoc });
      expect(isAiDiscussionComment(comment)).toBe(true);
    });

    it('returns true for reply when parent comment contains an agent mention', () => {
      const parent = commentFactory.build({
        id: 'parent-1',
        content: agentCommentDoc,
      });
      const reply = commentFactory.build({
        id: 'reply-1',
        parent_id: 'parent-1',
        content: plainCommentDoc,
      });

      expect(isAiDiscussionComment(reply, parent)).toBe(true);
    });

    it('returns true when reply itself contains an agent mention', () => {
      const parent = commentFactory.build({
        id: 'parent-1',
        content: plainCommentDoc,
      });
      const reply = commentFactory.build({
        id: 'reply-1',
        parent_id: 'parent-1',
        content: agentCommentDoc,
      });

      expect(isAiDiscussionComment(reply, parent)).toBe(true);
    });

    it('returns false for plain non-AI comments', () => {
      const parent = commentFactory.build({ content: plainCommentDoc });
      const reply = commentFactory.build({ content: plainCommentDoc });

      expect(isAiDiscussionComment(parent)).toBe(false);
      expect(isAiDiscussionComment(reply, parent)).toBe(false);
    });
  });

  describe('canUserHideComment (ownership and authorization)', () => {
    it('returns true when active user is the author of an AI discussion comment', () => {
      const comment = commentFactory.build({
        author_id: USER_A,
        content: agentCommentDoc,
      });

      expect(canUserHideComment(comment, USER_A)).toBe(true);
    });

    it('returns false when active user is NOT the author of the comment', () => {
      const comment = commentFactory.build({
        author_id: USER_A,
        content: agentCommentDoc,
      });

      // User B attempts to hide User A's comment
      expect(canUserHideComment(comment, USER_B)).toBe(false);
    });

    it('returns false when comment is not an AI discussion item', () => {
      const comment = commentFactory.build({
        author_id: USER_A,
        content: plainCommentDoc,
      });

      expect(canUserHideComment(comment, USER_A)).toBe(false);
    });

    it('returns false when active user ID is missing', () => {
      const comment = commentFactory.build({
        author_id: USER_A,
        content: agentCommentDoc,
      });

      expect(canUserHideComment(comment, undefined)).toBe(false);
      expect(canUserHideComment(comment, null)).toBe(false);
    });
  });

  describe('filterVisibleComments (parent and reply hiding behavior)', () => {
    const parent1 = commentFactory.build({
      id: 'parent-1',
      parent_id: null,
      content: agentCommentDoc,
    });
    const reply1A = commentFactory.build({
      id: 'reply-1a',
      parent_id: 'parent-1',
      content: plainCommentDoc,
    });
    const reply1B = commentFactory.build({
      id: 'reply-1b',
      parent_id: 'parent-1',
      content: plainCommentDoc,
    });

    const parent2 = commentFactory.build({
      id: 'parent-2',
      parent_id: null,
      content: plainCommentDoc,
    });
    const reply2A = commentFactory.build({
      id: 'reply-2a',
      parent_id: 'parent-2',
      content: plainCommentDoc,
    });

    const allComments = [parent1, reply1A, reply1B, parent2, reply2A];

    it('returns all comments when hidden set is empty', () => {
      const result = filterVisibleComments(allComments, new Set());
      expect(result).toHaveLength(5);
    });

    it('hides parent AND its entire thread (all replies) when parent is hidden', () => {
      const hidden = new Set(['parent-1']);
      const result = filterVisibleComments(allComments, hidden, false);

      const resultIds = result.map((c) => c.id);
      expect(resultIds).not.toContain('parent-1');
      expect(resultIds).not.toContain('reply-1a');
      expect(resultIds).not.toContain('reply-1b');

      // Parent 2 and its reply remain visible
      expect(resultIds).toContain('parent-2');
      expect(resultIds).toContain('reply-2a');
      expect(result).toHaveLength(2);
    });

    it('hides only the specific reply when a reply is hidden (parent stays visible)', () => {
      const hidden = new Set(['reply-1a']);
      const result = filterVisibleComments(allComments, hidden, false);

      const resultIds = result.map((c) => c.id);
      // Parent 1 remains visible
      expect(resultIds).toContain('parent-1');
      // Sibling reply 1B remains visible
      expect(resultIds).toContain('reply-1b');
      // Hidden reply 1A is omitted
      expect(resultIds).not.toContain('reply-1a');

      // Parent 2 and its reply remain visible
      expect(resultIds).toContain('parent-2');
      expect(resultIds).toContain('reply-2a');
      expect(result).toHaveLength(4);
    });

    it('returns all comments including hidden when showHidden is true', () => {
      const hidden = new Set(['parent-1', 'reply-2a']);
      const result = filterVisibleComments(allComments, hidden, true);

      expect(result).toHaveLength(5);
    });

    it('does not mutate the original comments array or objects', () => {
      const hidden = new Set(['parent-1']);
      const copy = [...allComments];
      filterVisibleComments(copy, hidden, false);

      expect(copy).toHaveLength(5);
      expect(parent1.status).toBe('active');
    });
  });
});
