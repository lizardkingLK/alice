import type { JSONContent } from '@tiptap/react';

type Mark = NonNullable<JSONContent['marks']>[number];

const HEADING_LINE = /^#{1,3}\s+/;
const BULLET_LINE = /^[-*]\s+/;
const ORDERED_LINE = /^\d+\.\s+/;
const QUOTE_LINE = /^>\s?/;

function escapeMarkdownInline(text: string): string {
  return text.replaceAll(/([\\`*_[\]()])/g, String.raw`\$1`);
}

function applyInlineMarks(text: string, marks: Mark[] | undefined): string {
  let out = escapeMarkdownInline(text);
  if (!marks?.length) {
    return out;
  }
  const ordered = [...marks].sort((a, b) => a.type.localeCompare(b.type));
  for (const mark of ordered) {
    switch (mark.type) {
      case 'bold':
        out = `**${out}**`;
        break;
      case 'italic':
        out = `*${out}*`;
        break;
      case 'code':
        out = `\`${text}\``;
        break;
      case 'link': {
        const href =
          typeof mark.attrs?.href === 'string' ? mark.attrs.href : '';
        out = href ? `[${out}](${href})` : out;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function inlineToMarkdown(nodes: JSONContent[] | undefined): string {
  if (!nodes?.length) {
    return '';
  }
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') {
        return '\n';
      }
      if (node.type === 'text') {
        return applyInlineMarks(node.text ?? '', node.marks);
      }
      if (node.type === 'emoji') {
        const emoji =
          typeof node.attrs?.emoji === 'string' ? node.attrs.emoji : '';
        return emoji;
      }
      return inlineToMarkdown(node.content);
    })
    .join('');
}

function blockToMarkdown(node: JSONContent, listIndex?: number): string {
  switch (node.type) {
    case 'paragraph':
      return inlineToMarkdown(node.content);
    case 'heading': {
      const level = Math.min(
        Math.max(
          typeof node.attrs?.level === 'number' ? node.attrs.level : 2,
          1
        ),
        3
      );
      return `${'#'.repeat(level)} ${inlineToMarkdown(node.content)}`;
    }
    case 'bulletList':
      return (node.content ?? [])
        .map((item) => blockToMarkdown(item))
        .filter(Boolean)
        .join('\n');
    case 'orderedList':
      return (node.content ?? [])
        .map((item, index) => blockToMarkdown(item, index + 1))
        .filter(Boolean)
        .join('\n');
    case 'listItem': {
      const prefix = listIndex === undefined ? '-' : `${listIndex}.`;
      const children = node.content ?? [];
      const lines = children
        .map((child) => blockToMarkdown(child))
        .join('\n')
        .split('\n');
      return lines
        .map((line, index) => (index === 0 ? `${prefix} ${line}` : `  ${line}`))
        .join('\n');
    }
    case 'blockquote': {
      const inner = (node.content ?? [])
        .map((child) => blockToMarkdown(child))
        .join('\n\n');
      return inner
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    }
    case 'codeBlock': {
      const language =
        typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      const code = inlineToMarkdown(node.content);
      return `\`\`\`${language}\n${code}\n\`\`\``;
    }
    case 'horizontalRule':
      return '---';
    default:
      return inlineToMarkdown(node.content);
  }
}

/** TipTap doc → markdown (subset used by agent instructions). */
export function instructionsDocToMarkdown(doc: JSONContent): string {
  const blocks = doc.content ?? [];
  return blocks
    .map((block) => blockToMarkdown(block))
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pushPlainText(nodes: JSONContent[], text: string): void {
  if (text.length > 0) {
    nodes.push({ type: 'text', text });
  }
}

type InlineToken = { node: JSONContent; nextIndex: number };

function consumeDelimitedMark(
  rest: string,
  index: number,
  open: string,
  close: string,
  markType: string
): InlineToken | null {
  if (!rest.startsWith(open)) {
    return null;
  }
  const end = rest.indexOf(close, open.length);
  if (end <= open.length) {
    return null;
  }
  return {
    node: {
      type: 'text',
      text: rest.slice(open.length, end),
      marks: [{ type: markType }],
    },
    nextIndex: index + end + close.length,
  };
}

function consumeLinkToken(rest: string, index: number): InlineToken | null {
  if (!rest.startsWith('[')) {
    return null;
  }
  const labelEnd = rest.indexOf(']');
  if (labelEnd <= 1 || rest[labelEnd + 1] !== '(') {
    return null;
  }
  const hrefEnd = rest.indexOf(')', labelEnd + 2);
  if (hrefEnd <= labelEnd + 2) {
    return null;
  }
  return {
    node: {
      type: 'text',
      text: rest.slice(1, labelEnd),
      marks: [
        {
          type: 'link',
          attrs: { href: rest.slice(labelEnd + 2, hrefEnd) },
        },
      ],
    },
    nextIndex: index + hrefEnd + 1,
  };
}

function tryConsumeInlineToken(
  text: string,
  index: number
): InlineToken | null {
  const rest = text.slice(index);
  return (
    consumeDelimitedMark(rest, index, '**', '**', 'bold') ??
    (rest.startsWith('**')
      ? null
      : consumeDelimitedMark(rest, index, '*', '*', 'italic')) ??
    consumeDelimitedMark(rest, index, '`', '`', 'code') ??
    consumeLinkToken(rest, index)
  );
}

/** Linear scan — avoids backtracking regex for inline marks. */
function parseInlineMarkdown(text: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  let index = 0;
  let plainStart = 0;

  while (index < text.length) {
    const token = tryConsumeInlineToken(text, index);
    if (!token) {
      index += 1;
      continue;
    }
    pushPlainText(nodes, text.slice(plainStart, index));
    nodes.push(token.node);
    index = token.nextIndex;
    plainStart = index;
  }

  pushPlainText(nodes, text.slice(plainStart));
  return nodes.length > 0 ? nodes : [{ type: 'text', text: '' }];
}

function paragraphFromLines(lines: string[]): JSONContent {
  const content: JSONContent[] = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      content.push({ type: 'hardBreak' });
    }
    content.push(...parseInlineMarkdown(line));
  });
  return { type: 'paragraph', content };
}

function parseListBlock(lines: string[], ordered: boolean): JSONContent {
  const items: JSONContent[] = [];
  for (const line of lines) {
    const text = line.replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, '');
    items.push({
      type: 'listItem',
      content: [paragraphFromLines([text])],
    });
  }
  return {
    type: ordered ? 'orderedList' : 'bulletList',
    content: items,
  };
}

function takeWhileMatching(
  lines: string[],
  start: number,
  // eslint-disable-next-line no-unused-vars -- predicate signature
  matches: (line: string) => boolean
): { taken: string[]; nextIndex: number } {
  const taken: string[] = [];
  let index = start;
  while (index < lines.length && matches(lines[index] ?? '')) {
    taken.push(lines[index] ?? '');
    index += 1;
  }
  return { taken, nextIndex: index };
}

function isParagraphContinuation(line: string): boolean {
  return (
    line.trim() !== '' &&
    !HEADING_LINE.test(line) &&
    !BULLET_LINE.test(line) &&
    !ORDERED_LINE.test(line) &&
    !line.startsWith('```') &&
    !QUOTE_LINE.test(line) &&
    line.trim() !== '---'
  );
}

function parseCodeFence(
  lines: string[],
  start: number,
  openingLine: string
): { block: JSONContent; nextIndex: number } {
  const language = openingLine.slice(3).trim();
  const { taken, nextIndex } = takeWhileMatching(
    lines,
    start + 1,
    (line) => !line.startsWith('```')
  );
  const afterClose = nextIndex < lines.length ? nextIndex + 1 : nextIndex;
  return {
    block: {
      type: 'codeBlock',
      attrs: { language: language || null },
      content: [{ type: 'text', text: taken.join('\n') }],
    },
    nextIndex: afterClose,
  };
}

const HEADING_MARKERS = /^#+/;

function parseHeadingLine(line: string): JSONContent {
  const markers = HEADING_MARKERS.exec(line);
  const level = Math.min(markers?.[0].length ?? 2, 3);
  return {
    type: 'heading',
    attrs: { level },
    content: parseInlineMarkdown(line.replace(HEADING_LINE, '')),
  };
}

function parseNextBlock(
  lines: string[],
  index: number
): { block: JSONContent; nextIndex: number } | null {
  const line = lines[index] ?? '';

  if (line.startsWith('```')) {
    return parseCodeFence(lines, index, line);
  }

  if (HEADING_LINE.test(line)) {
    return { block: parseHeadingLine(line), nextIndex: index + 1 };
  }

  if (line.trim() === '---') {
    return { block: { type: 'horizontalRule' }, nextIndex: index + 1 };
  }

  if (QUOTE_LINE.test(line)) {
    const { taken, nextIndex } = takeWhileMatching(lines, index, (entry) =>
      QUOTE_LINE.test(entry)
    );
    return {
      block: {
        type: 'blockquote',
        content: [
          paragraphFromLines(
            taken.map((entry) => entry.replace(QUOTE_LINE, ''))
          ),
        ],
      },
      nextIndex,
    };
  }

  if (BULLET_LINE.test(line)) {
    const { taken, nextIndex } = takeWhileMatching(lines, index, (entry) =>
      BULLET_LINE.test(entry)
    );
    return { block: parseListBlock(taken, false), nextIndex };
  }

  if (ORDERED_LINE.test(line)) {
    const { taken, nextIndex } = takeWhileMatching(lines, index, (entry) =>
      ORDERED_LINE.test(entry)
    );
    return { block: parseListBlock(taken, true), nextIndex };
  }

  const { taken, nextIndex } = takeWhileMatching(
    lines,
    index,
    isParagraphContinuation
  );
  return { block: paragraphFromLines(taken), nextIndex };
}

/**
 * Markdown / plain instructions → TipTap doc.
 * Preserves blank-line paragraphs and single-newline hard breaks.
 */
export function markdownToInstructionsDoc(markdown: string): JSONContent {
  const normalized = markdown.replaceAll('\r\n', '\n').trim();
  if (!normalized) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const blocks: JSONContent[] = [];
  const lines = normalized.split('\n');
  let index = 0;

  while (index < lines.length) {
    if ((lines[index] ?? '').trim() === '') {
      index += 1;
      continue;
    }
    const parsed = parseNextBlock(lines, index);
    if (!parsed) {
      break;
    }
    if (parsed.block.type !== 'paragraph' || parsed.block.content) {
      blocks.push(parsed.block);
    }
    index = parsed.nextIndex;
  }

  return {
    type: 'doc',
    content: blocks.length > 0 ? blocks : [{ type: 'paragraph' }],
  };
}
