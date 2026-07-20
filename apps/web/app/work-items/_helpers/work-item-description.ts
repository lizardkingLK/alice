import type { Json } from '@repo/types';
import type { JSONContent } from '@tiptap/react';
import { escapeHtml } from '@/app/work-items/_helpers/escape-html';
import { highlightCodeBlockHtml } from '@/app/work-items/_helpers/work-item-description-highlight';

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

export function nodeToPlainText(node: TiptapNode): string {
  if (node.type === 'hardBreak') {
    return '\n';
  }

  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }

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

export function nodeToHtml(node: TiptapNode): string {
  if (node.type === 'hardBreak') {
    return '<br />';
  }

  if (node.type === 'text' && typeof node.text === 'string') {
    return wrapWithMarks(escapeHtml(node.text), node.marks);
  }

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
      const rawCode = Array.isArray(node.content)
        ? node.content.map(nodeToPlainText).join('')
        : '';
      const highlighted = highlightCodeBlockHtml(rawCode, language);
      const classAttr = language
        ? ` class="language-${escapeHtml(language)}"`
        : '';
      const dataAttr = language
        ? ` data-language="${escapeHtml(language)}"`
        : '';
      return `<pre${dataAttr}><code${classAttr}>${highlighted}</code></pre>`;
    }

    case 'blockquote':
      return `<blockquote>${children}</blockquote>`;

    default:
      return children;
  }
}

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
