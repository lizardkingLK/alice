import type { Json } from '@repo/types';
import type { JSONContent } from '@tiptap/react';

type TiptapMark = {
  type?: string;
  attrs?: Record<string, unknown>;
};

type TiptapNode = {
  type?: string;
  text?: string;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  attrs?: Record<string, unknown>;
};

const EMPTY_DESCRIPTION = 'No description provided.';

function isJsonObject(
  value: Json
): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    if (!trimmed) {
      return null;
    }

    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: trimmed }],
        },
      ],
    };
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getAttrString(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = attrs?.[key];
  return typeof value === 'string' ? value : undefined;
}

function getAttrNumber(
  attrs: Record<string, unknown> | undefined,
  key: string
): number | undefined {
  const value = attrs?.[key];
  return typeof value === 'number' ? value : undefined;
}

function wrapWithMarks(html: string, marks: TiptapMark[] | undefined): string {
  if (!marks?.length) {
    return html;
  }

  return marks.reduceRight((inner, mark) => {
    switch (mark.type) {
      case 'bold':
        return `<strong>${inner}</strong>`;
      case 'italic':
        return `<em>${inner}</em>`;
      case 'underline':
        return `<u>${inner}</u>`;
      case 'code':
        return `<code>${inner}</code>`;
      case 'link': {
        const href = getAttrString(mark.attrs, 'href')?.trim();
        // Empty / placeholder hrefs resolve to "<origin>/#" in the browser.
        if (!href || href === '#') {
          return inner;
        }

        return `<a href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">${inner}</a>`;
      }
      default:
        return inner;
    }
  }, html);
}

/** Walk a TipTap node tree into plain text (lossy). */
export function nodeToPlainText(node: TiptapNode): string {
  if (node.type === 'hardBreak') {
    return '\n';
  }

  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }

  // Legacy seed shape: paragraph with a top-level `text` field.
  if (node.type === 'paragraph' && typeof node.text === 'string') {
    return node.text;
  }

  if (!Array.isArray(node.content)) {
    return '';
  }

  const parts = node.content.map(nodeToPlainText);

  if (node.type === 'listItem') {
    return parts.join('').trim();
  }

  if (node.type === 'bulletList') {
    return parts
      .filter(Boolean)
      .map((part) => `• ${part}`)
      .join('\n');
  }

  if (node.type === 'orderedList') {
    return parts
      .filter(Boolean)
      .map((part, index) => `${index + 1}. ${part}`)
      .join('\n');
  }

  if (node.type === 'codeBlock') {
    return parts.join('');
  }

  if (node.type === 'heading' || node.type === 'paragraph') {
    return parts.join('');
  }

  if (node.type === 'doc') {
    return parts.filter(Boolean).join('\n\n');
  }

  return parts.join('');
}

/** Walk a TipTap node tree into HTML for the description read view. */
export function nodeToHtml(node: TiptapNode): string {
  if (node.type === 'hardBreak') {
    return '<br />';
  }

  if (node.type === 'text' && typeof node.text === 'string') {
    return wrapWithMarks(escapeHtml(node.text), node.marks);
  }

  // Legacy seed shape: paragraph with a top-level `text` field.
  if (node.type === 'paragraph' && typeof node.text === 'string') {
    const text = escapeHtml(node.text);
    return text ? `<p>${text}</p>` : '<p></p>';
  }

  const children = Array.isArray(node.content)
    ? node.content.map(nodeToHtml).join('')
    : '';

  switch (node.type) {
    case 'doc':
      return children;

    case 'paragraph':
      return `<p>${children}</p>`;

    case 'heading': {
      const level = Math.min(
        Math.max(getAttrNumber(node.attrs, 'level') ?? 2, 1),
        3
      );
      return `<h${level}>${children}</h${level}>`;
    }

    case 'bulletList':
      return `<ul>${children}</ul>`;

    case 'orderedList':
      return `<ol>${children}</ol>`;

    case 'listItem':
      return `<li>${children}</li>`;

    case 'codeBlock': {
      const language = getAttrString(node.attrs, 'language');
      const classAttr = language
        ? ` class="language-${escapeHtml(language)}"`
        : '';
      return `<pre><code${classAttr}>${children}</code></pre>`;
    }

    case 'blockquote':
      return `<blockquote>${children}</blockquote>`;

    default:
      return children;
  }
}

export function extractWorkItemDescriptionText(
  description: Json | null
): string {
  if (!description) {
    return EMPTY_DESCRIPTION;
  }

  if (typeof description === 'string') {
    return description.trim() || EMPTY_DESCRIPTION;
  }

  if (typeof description !== 'object' || Array.isArray(description)) {
    return EMPTY_DESCRIPTION;
  }

  const text = nodeToPlainText(description as TiptapNode);
  return text.trim() || EMPTY_DESCRIPTION;
}

/** TipTap / legacy JSONB → HTML string for `DescriptionView`. */
export function descriptionToHtml(description: Json | null): string {
  if (!description) {
    return `<p>${escapeHtml(EMPTY_DESCRIPTION)}</p>`;
  }

  if (typeof description === 'string') {
    const trimmed = description.trim();
    if (!trimmed) {
      return `<p>${escapeHtml(EMPTY_DESCRIPTION)}</p>`;
    }

    return `<p>${escapeHtml(trimmed)}</p>`;
  }

  if (typeof description !== 'object' || Array.isArray(description)) {
    return `<p>${escapeHtml(EMPTY_DESCRIPTION)}</p>`;
  }

  const html = nodeToHtml(description as TiptapNode).trim();
  return html || `<p>${escapeHtml(EMPTY_DESCRIPTION)}</p>`;
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
