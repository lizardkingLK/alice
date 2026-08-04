import type { Json } from '@repo/types';
import type { JSONContent } from '@tiptap/react';
import type { TiptapNode } from '@/app/work-items/_helpers/work-item-description-types';

function isJsonObject(
  value: Json
): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringToDoc(text: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

function legacyParagraphToDoc(node: TiptapNode): JSONContent {
  const text = typeof node.text === 'string' ? node.text : '';

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: text ? [{ type: 'text', text }] : [],
      },
    ],
  };
}

/** Supabase JSONB → TipTap editor document (DB/UI boundary). */
export function toTiptapContent(description: Json | null): JSONContent | null {
  if (description === null) {
    return null;
  }

  if (typeof description === 'string') {
    const trimmed = description.trim();
    return trimmed ? stringToDoc(trimmed) : null;
  }

  if (!isJsonObject(description)) {
    return null;
  }

  if (description.type === 'doc' && Array.isArray(description.content)) {
    return description as unknown as JSONContent;
  }

  if (
    description.type === 'paragraph' &&
    typeof description.text === 'string'
  ) {
    return legacyParagraphToDoc(description as TiptapNode);
  }

  return null;
}

/** TipTap editor document → Supabase JSONB (DB/UI boundary). */
export function fromTiptapContent(content: JSONContent): Json {
  return content as unknown as Json;
}

export function isTiptapDocument(
  description: Json | null
): description is Json & { type: 'doc' } {
  return (
    typeof description === 'object' &&
    description !== null &&
    !Array.isArray(description) &&
    'type' in description &&
    description.type === 'doc'
  );
}
