import { describe, expect, it } from 'vitest';
import { serializeCommentDoc } from '@/lib/editor/serialize-comment-doc';

describe('serializeCommentDoc', () => {
  it('keeps mention id/label as plain strings for storage', () => {
    const serialized = serializeCommentDoc({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'mention',
              attrs: {
                id: 'user-1',
                label: 'Alice Admin',
                title: null,
                mentionType: 'user',
                mentionSuggestionChar: '@',
              },
            },
            { type: 'text', text: ' okay' },
          ],
        },
      ],
    });

    expect(serialized).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'mention',
              attrs: {
                id: 'user-1',
                label: 'Alice Admin',
                mentionType: 'user',
                mentionSuggestionChar: '@',
              },
            },
            { type: 'text', text: ' okay' },
          ],
        },
      ],
    });
  });

  it('keeps work-item key and title on workItemMention nodes', () => {
    const serialized = serializeCommentDoc({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'workItemMention',
              attrs: {
                id: 'wi-1',
                label: 'AL-1',
                title: 'just do it',
                mentionType: 'workItem',
                mentionSuggestionChar: '#',
              },
            },
          ],
        },
      ],
    });

    expect(serialized.content?.[0]?.content?.[0]?.attrs).toMatchObject({
      id: 'wi-1',
      label: 'AL-1',
      title: 'just do it',
      mentionType: 'workItem',
    });
  });
});
