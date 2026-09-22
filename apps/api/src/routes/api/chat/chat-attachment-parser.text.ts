import {
  mapToWorkItemType,
  DEFAULT_WORK_ITEM_PRIORITY,
  WorkItemTypeEnum,
  type WorkItemType,
  type WorkItemPriority,
  type ParsedWorkItemNode,
} from '@repo/types';
import { TAB, PIPE, normalizePriority } from './chat-attachment-parser.common';
import { parseDelimitedRowToWorkItem } from './chat-attachment-parser.delimited';

export function isMarkdownTable(content: string): boolean {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return false;
  const first = lines[0] || '';
  const second = lines[1] || '';
  return (
    first.includes(PIPE) &&
    second.includes(PIPE) &&
    second.replace(/[\s|:-]/g, '').length === 0
  );
}

export function parseMarkdownTableWorkItemDocument(
  fileContent: string
): ParsedWorkItemNode[] {
  const rawLines = fileContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const tableLines = rawLines.filter((line) => line.includes(PIPE));
  if (tableLines.length < 2) return [];

  const cleanHeaderLine = tableLines[0]!.replace(/^\|/, '').replace(/\|$/, '');
  const rawHeaders = cleanHeaderLine.split(PIPE).map((h) => h.trim());
  const normalizedHeaders = rawHeaders.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  const parsedItems: ParsedWorkItemNode[] = [];
  let itemIndex = 1;

  for (let i = 1; i < tableLines.length; i++) {
    const line = tableLines[i]!;
    if (line.replace(/[\s|:-]/g, '').length === 0) continue;

    const cleanLine = line.replace(/^\|/, '').replace(/\|$/, '');
    const rowValues = cleanLine.split(PIPE).map((c) => c.trim());

    parsedItems.push(
      parseDelimitedRowToWorkItem(
        rowValues,
        rawHeaders,
        normalizedHeaders,
        itemIndex++
      )
    );
  }

  return parsedItems;
}

export function isIndentedOutline(content: string): boolean {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return false;
  const bulletCount = lines.filter((l) => /^[-*+]\s|^[\d.]+\s/.test(l)).length;
  return bulletCount >= 2;
}

export interface OutlineStackItem {
  indent: number;
  identifier: string;
  title: string;
}

export const OUTLINE_TYPE_PATTERNS: readonly RegExp[] = [
  /^\[(Epic|Feature|Story|Task|Issue|Bug)\]\s*(.*)/i,
  /^(Epic|Feature|Story|Task|Issue|Bug):\s*(.*)/i,
];

export function extractTypeFromOutlineLine(text: string): {
  type: WorkItemType | null;
  cleanText: string;
} {
  for (const pattern of OUTLINE_TYPE_PATTERNS) {
    const match = pattern.exec(text);
    if (match?.[1] && match[2] !== undefined) {
      return {
        type: mapToWorkItemType(match[1]),
        cleanText: match[2].trim(),
      };
    }
  }

  return { type: null, cleanText: text };
}

export interface InlineMetadataAccumulator {
  priority?: WorkItemPriority;
  storyPoints: number | null;
  key: string | null;
}

export const INLINE_METADATA_HANDLERS: Readonly<
  Record<
    string,
    (value: string, accumulator: InlineMetadataAccumulator) => void
  >
> = {
  priority: (val, acc) => {
    acc.priority = normalizePriority(val);
  },
  points: (val, acc) => {
    const num = Number(val);
    if (!Number.isNaN(num)) acc.storyPoints = Math.round(num);
  },
  storypoints: (val, acc) => {
    const num = Number(val);
    if (!Number.isNaN(num)) acc.storyPoints = Math.round(num);
  },
  estimate: (val, acc) => {
    const num = Number(val);
    if (!Number.isNaN(num)) acc.storyPoints = Math.round(num);
  },
  key: (val, acc) => {
    acc.key = val;
  },
  jirakey: (val, acc) => {
    acc.key = val;
  },
  issuekey: (val, acc) => {
    acc.key = val;
  },
};

export function parseInlineMetadata(metaStr: string): {
  priority?: WorkItemPriority;
  storyPoints?: number | null;
  key?: string | null;
  dynamicFields: Record<string, unknown>;
} {
  const dynamicFields: Record<string, unknown> = {};
  const accumulator: InlineMetadataAccumulator = {
    storyPoints: null,
    key: null,
  };

  const parts = metaStr.split(/[,;]/);
  for (const part of parts) {
    const [rawKey, ...valParts] = part.split(':');
    if (!rawKey || valParts.length === 0) continue;
    const k = rawKey.trim();
    const v = valParts.join(':').trim();
    const normalized = k.toLowerCase().replace(/[^a-z0-9]/g, '');

    const handler = INLINE_METADATA_HANDLERS[normalized];
    if (handler) {
      handler(v, accumulator);
    } else {
      dynamicFields[k] = v;
    }
  }

  return {
    priority: accumulator.priority,
    storyPoints: accumulator.storyPoints,
    key: accumulator.key,
    dynamicFields,
  };
}

export function extractMetadataFromOutlineLine(text: string): {
  cleanText: string;
  priority?: WorkItemPriority;
  storyPoints?: number | null;
  key?: string | null;
  dynamicFields: Record<string, unknown>;
} {
  if (!text.endsWith(')')) {
    return { cleanText: text, dynamicFields: {} };
  }

  const openParenIdx = text.lastIndexOf('(');
  if (openParenIdx < 0) {
    return { cleanText: text, dynamicFields: {} };
  }

  const metaStr = text.slice(openParenIdx + 1, -1).trim();
  const cleanText = text.slice(0, openParenIdx).trim();
  const parsedMeta = parseInlineMetadata(metaStr);

  return {
    cleanText,
    priority: parsedMeta.priority,
    storyPoints: parsedMeta.storyPoints,
    key: parsedMeta.key,
    dynamicFields: parsedMeta.dynamicFields,
  };
}

export function parseIndentedTextWorkItemDocument(
  fileContent: string
): ParsedWorkItemNode[] {
  const lines = fileContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const items: ParsedWorkItemNode[] = [];
  const stack: OutlineStackItem[] = [];
  const defaultTypesByDepth: WorkItemType[] = [
    WorkItemTypeEnum.Epic,
    WorkItemTypeEnum.Feature,
    WorkItemTypeEnum.Story,
    WorkItemTypeEnum.Task,
  ];

  let itemCounter = 1;

  for (const line of lines) {
    const expandedLine = line.replaceAll(TAB, '  ');
    const indent = expandedLine.search(/\S/);
    let trimmed = expandedLine.trim();

    trimmed = trimmed.replace(/^[-*+]\s+/, '').replace(/^[\d.]+\s+/, '');

    const { type: explicitType, cleanText: textWithoutType } =
      extractTypeFromOutlineLine(trimmed);

    const {
      cleanText: textWithoutMeta,
      priority,
      storyPoints,
      key,
      dynamicFields,
    } = extractMetadataFromOutlineLine(textWithoutType);

    let title = textWithoutMeta;
    let description: string | null = null;
    const colonIndex = textWithoutMeta.indexOf(':');
    if (colonIndex > 0) {
      title = textWithoutMeta.slice(0, colonIndex).trim();
      description = textWithoutMeta.slice(colonIndex + 1).trim() || null;
    }

    while (stack.length > 0 && stack.at(-1)!.indent >= indent) {
      stack.pop();
    }

    const parent = stack.length > 0 ? stack.at(-1) : null;
    const depth = stack.length;
    const itemType =
      explicitType ||
      defaultTypesByDepth[Math.min(depth, defaultTypesByDepth.length - 1)] ||
      WorkItemTypeEnum.Task;
    const temporaryIdentifier = key || `outline-item-${itemCounter++}`;

    const parsedNode: ParsedWorkItemNode = {
      temporaryIdentifier,
      title: title || `Work Item ${itemCounter}`,
      type: itemType,
      priority: priority || DEFAULT_WORK_ITEM_PRIORITY,
      description,
      storyPoints: storyPoints ?? null,
      jiraIssueKey: key ?? null,
      parentReference: parent ? parent.identifier : null,
      dynamicFields:
        Object.keys(dynamicFields).length > 0 ? dynamicFields : undefined,
    };

    items.push(parsedNode);
    stack.push({ indent, identifier: temporaryIdentifier, title });
  }

  return items;
}
