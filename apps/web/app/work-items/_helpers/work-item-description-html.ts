import type { Json } from '@repo/types';
import { escapeHtml } from '@/app/work-items/_helpers/work-item-escape-html';
import { highlightCodeBlockHtml } from '@/app/work-items/_helpers/work-item-description-highlight';
import { nodeToPlainText } from '@/app/work-items/_helpers/work-item-description-plain-text';
import {
  EMPTY_DESCRIPTION,
  getAttrNumber,
  getAttrString,
  type TiptapMark,
  type TiptapNode,
} from '@/app/work-items/_helpers/work-item-description-types';
import { resolveEmojiPlainText } from '@/lib/editor/resolve-emoji';
import { foldMarks, mapInlineMark } from '@/lib/editor/tiptap-marks';

function wrapWithMarks(html: string, marks: TiptapMark[] | undefined): string {
  return foldMarks(
    html,
    marks,
    (inner, mark) =>
      mapInlineMark(mark, inner, {
        bold: (value) => `<strong>${value}</strong>`,
        italic: (value) => `<em>${value}</em>`,
        underline: (value) => `<u>${value}</u>`,
        code: (value) => `<code>${value}</code>`,
        link: (value, href) =>
          `<a href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">${value}</a>`,
      }),
    true
  );
}

function codeBlockHtml(node: TiptapNode): string {
  const language = getAttrString(node.attrs, 'language');
  const rawCode = Array.isArray(node.content)
    ? node.content.map(nodeToPlainText).join('')
    : '';
  const highlighted = highlightCodeBlockHtml(rawCode, language);
  const classAttr = language ? ` class="language-${escapeHtml(language)}"` : '';
  const dataAttr = language ? ` data-language="${escapeHtml(language)}"` : '';
  return `<pre${dataAttr}><code${classAttr}>${highlighted}</code></pre>`;
}

function mentionHtml(node: TiptapNode): string {
  const label = getAttrString(node.attrs, 'label') ?? '';
  const mentionType = getAttrString(node.attrs, 'mentionType');
  if (node.type === 'workItemMention' || mentionType === 'workItem') {
    return `<span class="comment-work-item-mention">#${escapeHtml(label)}</span>`;
  }
  return `<span class="comment-user-mention">@${escapeHtml(label)}</span>`;
}

function containerHtml(node: TiptapNode, children: string): string {
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
    case 'codeBlock':
      return codeBlockHtml(node);
    case 'blockquote':
      return `<blockquote>${children}</blockquote>`;
    case 'mention':
    case 'workItemMention':
      return mentionHtml(node);
    default:
      return children;
  }
}

export function nodeToHtml(node: TiptapNode): string {
  if (node.type === 'hardBreak') {
    return '<br />';
  }

  if (node.type === 'emoji') {
    return escapeHtml(resolveEmojiPlainText(node));
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

  return containerHtml(node, children);
}

function emptyDescriptionHtml(): string {
  return `<p>${escapeHtml(EMPTY_DESCRIPTION)}</p>`;
}

export function descriptionToHtml(description: Json | null): string {
  if (!description) {
    return emptyDescriptionHtml();
  }

  if (typeof description === 'string') {
    const trimmed = description.trim();
    if (!trimmed) {
      return emptyDescriptionHtml();
    }
    return `<p>${escapeHtml(trimmed)}</p>`;
  }

  if (typeof description !== 'object' || Array.isArray(description)) {
    return emptyDescriptionHtml();
  }

  const html = nodeToHtml(description as TiptapNode).trim();
  return html || emptyDescriptionHtml();
}
