import { describe, expect, it } from 'vitest';
import {
  hydrateEmojiNodesInDoc,
  resolveEmojiPlainText,
} from '@/lib/editor/resolve-emoji';

describe('resolve-emoji', () => {
  it('resolves emoji nodes that only store a TipTap name attr', () => {
    expect(
      resolveEmojiPlainText({
        type: 'emoji',
        attrs: { name: 'tada' },
      })
    ).toBe('🎉');
  });

  it('prefers attrs.emoji when present', () => {
    expect(
      resolveEmojiPlainText({
        type: 'emoji',
        attrs: { name: 'tada', emoji: '🎊' },
      })
    ).toBe('🎊');
  });

  it('hydrates unicode onto emoji nodes in a doc', () => {
    const hydrated = hydrateEmojiNodesInDoc({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'emoji', attrs: { name: 'tada' } },
            { type: 'text', text: ' Looks good!' },
          ],
        },
      ],
    });

    expect(hydrated).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'emoji', attrs: { name: 'tada', emoji: '🎉' } },
            { type: 'text', text: ' Looks good!' },
          ],
        },
      ],
    });
  });
});
