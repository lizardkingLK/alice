import type { JSONContent } from '@tiptap/react';

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function serializeMentionNode(node: JSONContent): JSONContent {
  const attrs = node.attrs ?? {};
  const isWorkItem =
    node.type === 'workItemMention' || attrs.mentionType === 'workItem';

  const id = asNonEmptyString(attrs.id) ?? '';
  const label = asNonEmptyString(attrs.label) ?? id;
  const title = asNonEmptyString(attrs.title);

  return {
    type: isWorkItem ? 'workItemMention' : 'mention',
    attrs: {
      id,
      label,
      ...(title ? { title } : {}),
      mentionType: isWorkItem ? 'workItem' : 'user',
      mentionSuggestionChar: isWorkItem ? '#' : '@',
    },
  };
}

function serializeNode(node: JSONContent): JSONContent {
  if (node.type === 'mention' || node.type === 'workItemMention') {
    return serializeMentionNode(node);
  }

  if (!Array.isArray(node.content)) {
    return node;
  }

  return {
    ...node,
    content: node.content.map(serializeNode),
  };
}

/**
 * Deep-clone TipTap JSON and force mention attrs to plain strings so
 * server-action / JSONB round-trips never drop id/label/title.
 */
export function serializeCommentDoc(doc: JSONContent): JSONContent {
  const cloned = JSON.parse(JSON.stringify(doc)) as JSONContent;
  return serializeNode(cloned);
}
