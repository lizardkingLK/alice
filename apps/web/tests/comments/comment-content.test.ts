import { describe, expect, it } from 'vitest';
import {
  commentContentToPlainText,
  createCommentSnippet,
  extractMentionedUserIdsFromContent,
  isCommentDocEmpty,
  isValidCommentDoc,
  parseLegacyCommentMarkup,
  plainTextToCommentDoc,
  toCommentTiptapContent,
} from '@repo/types';

describe('comment-content helpers', () => {
  it('wraps plain text as a TipTap doc', () => {
    const doc = plainTextToCommentDoc('hello world');
    expect(doc.type).toBe('doc');
    expect(commentContentToPlainText(doc)).toBe('hello world');
    expect(isCommentDocEmpty(doc)).toBe(false);
  });

  it('parses legacy @ and # markup into mention nodes', () => {
    const nodes = parseLegacyCommentMarkup(
      'Hi @[Alice](u1) see #[ALICE-1](w1)'
    );
    expect(nodes).toEqual([
      { type: 'text', text: 'Hi ' },
      {
        type: 'mention',
        attrs: { id: 'u1', label: 'Alice', mentionType: 'user' },
      },
      { type: 'text', text: ' see ' },
      {
        type: 'workItemMention',
        attrs: { id: 'w1', label: 'ALICE-1', mentionType: 'workItem' },
      },
    ]);
  });

  it('extracts mentioned user ids from JSON docs', () => {
    const doc = toCommentTiptapContent(
      'Ping @[Alice](user-a) and @[Bob](user-b)'
    );
    expect(extractMentionedUserIdsFromContent(doc, 'user-a')).toEqual([
      'user-b',
    ]);
  });

  it('builds snippets without markup noise', () => {
    const doc = plainTextToCommentDoc('Hello @[Alice](u1) there');
    expect(createCommentSnippet(doc, 20)).toBe('Hello @Alice there');
  });

  it('rejects empty docs for validation', () => {
    expect(
      isValidCommentDoc({ type: 'doc', content: [{ type: 'paragraph' }] })
    ).toBe(false);
    expect(isValidCommentDoc(plainTextToCommentDoc('ok'))).toBe(true);
  });
});
