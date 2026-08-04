import type { Json } from './generated/supabase/database.types.js';
import {
  emojiPlainText,
  getAttrString,
  mentionPlainText,
  normalizeMentionNode,
} from './tiptap-node-attrs.js';

/** TipTap JSON node shape used for comment content (subset). */
export type CommentTiptapNode = {
  type?: string;
  text?: string;
  content?: CommentTiptapNode[];
  attrs?: { [key: string]: Json | undefined };
  marks?: Array<{
    type: string;
    attrs?: { [key: string]: Json | undefined };
  }>;
};

type NullableTiptapContent = Json | string | null | undefined;

export type CommentTiptapDoc = {
  type: 'doc';
  content?: CommentTiptapNode[];
};

const LEGACY_MENTION_REGEX = /([@#])\[([^\]]+)\]\(([^)]+)\)/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textNode(text: string): CommentTiptapNode {
  return { type: 'text', text };
}

function userMentionNode(label: string, id: string): CommentTiptapNode {
  return {
    type: 'mention',
    attrs: { id, label, mentionType: 'user' },
  };
}

function workItemMentionNode(
  label: string,
  id: string,
  title?: string
): CommentTiptapNode {
  return {
    type: 'workItemMention',
    attrs: {
      id,
      label,
      mentionType: 'workItem',
      ...(title ? { title } : {}),
    },
  };
}

/** Parse legacy `@[Name](id)` / `#[KEY](id)` markup into TipTap inline nodes. */
export function parseLegacyCommentMarkup(text: string): CommentTiptapNode[] {
  const nodes: CommentTiptapNode[] = [];
  let lastIndex = 0;
  const regex = new RegExp(LEGACY_MENTION_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(textNode(text.slice(lastIndex, match.index)));
    }

    const marker = match[1];
    const label = match[2] ?? '';
    const id = match[3] ?? '';

    if (marker === '@') {
      nodes.push(userMentionNode(label, id));
    } else {
      nodes.push(workItemMentionNode(label, id));
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(textNode(text.slice(lastIndex)));
  }

  return nodes.length > 0 ? nodes : [];
}

export function plainTextToCommentDoc(text: string): CommentTiptapDoc {
  const trimmed = text.trim();
  const inline = trimmed ? parseLegacyCommentMarkup(trimmed) : [];

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: inline.length > 0 ? inline : undefined,
      },
    ],
  };
}

export function emptyCommentDoc(): CommentTiptapDoc {
  return {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  };
}

/**
 * Normalize DB/API comment content to a TipTap doc.
 * Accepts legacy plain strings, stringified TipTap JSON, and TipTap objects
 * (including docs that still contain `@[Name](id)` text).
 */
export function toCommentTiptapContent(
  content: NullableTiptapContent
): CommentTiptapDoc {
  if (content == null) {
    return emptyCommentDoc();
  }

  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (isRecord(parsed) && parsed.type === 'doc') {
          return normalizeDocMentions(parsed as CommentTiptapDoc);
        }
      } catch {
        // Fall through to legacy plain-text handling.
      }
    }
    return plainTextToCommentDoc(content);
  }

  if (!isRecord(content) || content.type !== 'doc') {
    return emptyCommentDoc();
  }

  return normalizeDocMentions(content as CommentTiptapDoc);
}

function normalizeMentionAttrs(node: CommentTiptapNode): CommentTiptapNode {
  if (node.type !== 'mention' && node.type !== 'workItemMention') {
    return node;
  }

  return normalizeMentionNode({
    type: node.type,
    attrs: node.attrs ?? null,
  }) as CommentTiptapNode;
}

function normalizeInlineNodes(nodes: CommentTiptapNode[]): CommentTiptapNode[] {
  const result: CommentTiptapNode[] = [];

  for (const node of nodes) {
    if (node.type === 'text' && typeof node.text === 'string') {
      const parsed = parseLegacyCommentMarkup(node.text);
      if (
        parsed.length === 1 &&
        parsed[0]?.type === 'text' &&
        parsed[0].text === node.text
      ) {
        result.push(node);
      } else {
        result.push(...parsed);
      }
      continue;
    }

    if (node.type === 'mention' || node.type === 'workItemMention') {
      result.push(normalizeMentionAttrs(node));
      continue;
    }

    if (Array.isArray(node.content)) {
      result.push({
        ...node,
        content: normalizeInlineNodes(node.content),
      });
      continue;
    }

    result.push(node);
  }

  return result;
}

function normalizeDocMentions(doc: CommentTiptapDoc): CommentTiptapDoc {
  if (!Array.isArray(doc.content)) {
    return doc;
  }

  return {
    ...doc,
    content: doc.content.map((block) => {
      if (!Array.isArray(block.content)) {
        return block;
      }
      return {
        ...block,
        content: normalizeInlineNodes(block.content),
      };
    }),
  };
}

function walkNodes(
  node: CommentTiptapNode,
  visit: (node: CommentTiptapNode) => void,
  depth = 0,
  state?: { count: number }
): void {
  const walkState = state ?? { count: 0 };
  const MAX_DEPTH = 32;
  const MAX_NODES = 5_000;
  if (depth > MAX_DEPTH || walkState.count >= MAX_NODES) {
    return;
  }
  walkState.count += 1;
  visit(node);
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      walkNodes(child, visit, depth + 1, walkState);
    }
  }
}

export function extractMentionedUserIdsFromContent(
  content: NullableTiptapContent,
  actorId: string
): string[] {
  const doc = toCommentTiptapContent(content);
  const ids = new Set<string>();

  walkNodes(doc, (node) => {
    if (node.type !== 'mention') {
      return;
    }
    const mentionType = getAttrString(node.attrs, 'mentionType');
    if (mentionType === 'workItem') {
      return;
    }
    const id = getAttrString(node.attrs, 'id');
    if (id && id !== actorId) {
      ids.add(id);
    }
  });

  // Legacy string fallback already handled by toCommentTiptapContent.
  return Array.from(ids);
}

export function commentContentToPlainText(
  content: NullableTiptapContent
): string {
  const doc = toCommentTiptapContent(content);

  const parts: string[] = [];
  walkNodes(doc, (node) => {
    if (
      node.type === 'paragraph' ||
      node.type === 'listItem' ||
      node.type === 'blockquote'
    ) {
      if (parts.length > 0 && !parts.at(-1)?.endsWith('\n')) {
        parts.push('\n');
      }
      return;
    }
    if (node.type === 'text' && typeof node.text === 'string') {
      parts.push(node.text);
      return;
    }
    if (node.type === 'hardBreak') {
      parts.push('\n');
      return;
    }
    if (node.type === 'emoji') {
      parts.push(emojiPlainText(node));
      return;
    }
    if (node.type === 'mention' || node.type === 'workItemMention') {
      parts.push(mentionPlainText(node));
    }
  });

  return parts
    .join('')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function createCommentSnippet(
  content: Json | string | null | undefined,
  limit = 60
): string {
  const plain = commentContentToPlainText(content);
  if (plain.length > limit) {
    return `${plain.slice(0, limit)}...`;
  }
  return plain;
}

export function isCommentDocEmpty(
  content: Json | string | null | undefined
): boolean {
  return commentContentToPlainText(content).length === 0;
}

/** Loose Zod-friendly check: non-empty TipTap doc object. */
export function isValidCommentDoc(value: unknown): value is CommentTiptapDoc {
  if (!isRecord(value) || value.type !== 'doc') {
    return false;
  }
  return !isCommentDocEmpty(value as Json);
}
