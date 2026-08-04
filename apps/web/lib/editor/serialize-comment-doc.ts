import type { JSONContent } from '@tiptap/react';
import { normalizeMentionNode, type TiptapAttrs } from '@repo/types';

function serializeMentionNode(node: JSONContent): JSONContent {
  return normalizeMentionNode({
    type: node.type,
    attrs: (node.attrs ?? null) as TiptapAttrs,
  });
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
  const cloned = structuredClone(doc);
  return serializeNode(cloned);
}
