import {
  emojiToShortcode,
  gitHubEmojis,
  shortcodeToEmoji,
} from '@tiptap/extension-emoji';
import type { JSONContent } from '@tiptap/react';
import { getAttrString, type TiptapLeafNode } from '@repo/types';

/** Resolve a TipTap emoji node to a unicode glyph (attrs.emoji or name lookup). */
export function resolveEmojiPlainText(node: TiptapLeafNode): string {
  const direct = getAttrString(node.attrs, 'emoji');
  if (direct) {
    return direct;
  }

  const name = getAttrString(node.attrs, 'name');
  if (!name) {
    return '';
  }

  const item = shortcodeToEmoji(name, gitHubEmojis);
  return item?.emoji ?? `:${name}:`;
}

function hydrateNode(node: JSONContent): JSONContent {
  if (node.type === 'emoji') {
    const name = getAttrString(node.attrs, 'name');
    const existing = getAttrString(node.attrs, 'emoji');
    if (!name || existing) {
      return node;
    }
    const item = shortcodeToEmoji(name, gitHubEmojis);
    if (!item?.emoji) {
      return node;
    }
    return {
      ...node,
      attrs: {
        ...node.attrs,
        name,
        emoji: item.emoji,
      },
    };
  }

  if (!Array.isArray(node.content)) {
    return node;
  }

  return {
    ...node,
    content: node.content.map(hydrateNode),
  };
}

/** Persist unicode on emoji nodes so API/snippets/renderers don't need TipTap. */
export function hydrateEmojiNodesInDoc(doc: JSONContent): JSONContent {
  return hydrateNode(doc);
}

export function emojiCharToShortcode(emoji: string): string | undefined {
  return emojiToShortcode(emoji, gitHubEmojis);
}
