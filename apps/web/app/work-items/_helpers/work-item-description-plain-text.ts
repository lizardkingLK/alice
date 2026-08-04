import type { Json } from '@repo/types';
import {
  mentionPlainText,
  type TiptapNode,
} from '@/app/work-items/_helpers/work-item-description-types';
import { resolveEmojiPlainText } from '@/lib/editor/resolve-emoji';

function formatChildParts(node: TiptapNode, parts: string[]): string {
  switch (node.type) {
    case 'listItem':
      return parts.join('').trim();
    case 'bulletList':
      return parts
        .filter(Boolean)
        .map((part) => `• ${part}`)
        .join('\n');
    case 'orderedList':
      return parts
        .filter(Boolean)
        .map((part, index) => `${index + 1}. ${part}`)
        .join('\n');
    case 'codeBlock':
    case 'heading':
    case 'paragraph':
      return parts.join('');
    case 'doc':
      return parts.filter(Boolean).join('\n\n');
    default:
      return parts.join('');
  }
}

export function nodeToPlainText(node: TiptapNode): string {
  if (node.type === 'hardBreak') {
    return '\n';
  }

  if (node.type === 'emoji') {
    return resolveEmojiPlainText(node);
  }

  if (node.type === 'mention' || node.type === 'workItemMention') {
    return mentionPlainText(node);
  }

  if (
    (node.type === 'text' || node.type === 'paragraph') &&
    typeof node.text === 'string'
  ) {
    return node.text;
  }

  if (!Array.isArray(node.content)) {
    return '';
  }

  return formatChildParts(node, node.content.map(nodeToPlainText));
}

/** TipTap / JSON description → plain text preview (no HTML). */
export function descriptionToPlainText(description: Json | null): string {
  if (!description) {
    return '';
  }

  if (typeof description === 'string') {
    return description.trim();
  }

  if (typeof description !== 'object' || Array.isArray(description)) {
    return '';
  }

  return nodeToPlainText(description as TiptapNode)
    .replace(/\n+/g, ' ')
    .trim();
}
