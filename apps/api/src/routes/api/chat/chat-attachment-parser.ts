import {
  mapToWorkItemType,
  DEFAULT_WORK_ITEM_PRIORITY,
  WORK_ITEM_PRIORITIES,
  WorkItemTypeEnum,
  type WorkItemType,
  type WorkItemPriority,
  type ParsedWorkItemNode,
  ChatAttachmentFileTypeEnum,
} from '@repo/types';
import { sanitizeLog } from './chat.utils';

const STANDARD_FIELD_KEYS = new Set([
  'title',
  'name',
  'summary',
  'workitem',
  'item',
  'taskname',
  'task',
  'type',
  'issuetype',
  'issue_type',
  'kind',
  'workitemtype',
  'priority',
  'description',
  'desc',
  'details',
  'status',
  'state',
  'storypoints',
  'story_points',
  'points',
  'estimate',
  'duedate',
  'due_date',
  'deadline',
  'labels',
  'tags',
  'jiraissuekey',
  'jira_issue_key',
  'jirakey',
  'key',
  'issuekey',
  'parent',
  'parentid',
  'parent_id',
  'parentreference',
  'parent_reference',
  'parenttitle',
  'parent_title',
  'parentname',
  'parent_name',
  'parentkey',
  'parent_key',
  'parentsummary',
  'parent_summary',
  'parentlink',
  'parent_link',
  'epic',
  'epiclink',
  'epic_link',
  'epickey',
  'epic_key',
  'epictitle',
  'epic_title',
  'children',
  'subtasks',
  'sub_tasks',
  'items',
  'id',
  'tempid',
  'issueid',
  'temporaryidentifier',
]);

function normalizePriority(rawPriority: unknown): WorkItemPriority {
  if (typeof rawPriority === 'string') {
    const trimmed = rawPriority.trim().toLowerCase();
    if ((WORK_ITEM_PRIORITIES as readonly string[]).includes(trimmed)) {
      return trimmed as WorkItemPriority;
    }
  }
  return DEFAULT_WORK_ITEM_PRIORITY;
}

function normalizeLabels(rawLabels: unknown): string[] {
  if (Array.isArray(rawLabels)) {
    return rawLabels.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof rawLabels === 'string') {
    return rawLabels
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function extractFirstString(
  record: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const val = record[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return undefined;
}

function extractFirstNumber(
  record: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const key of keys) {
    const val = record[key];
    if (typeof val === 'number' && !Number.isNaN(val)) {
      return val;
    }
    if (typeof val === 'string' && val.trim().length > 0) {
      const parsed = Number(val);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

const CHILD_COLLECTION_KEYS = ['children', 'subtasks', 'sub_tasks'] as const;
const CANDIDATE_ARRAY_KEYS = ['workItems', 'items', 'data'] as const;

function extractRawChildren(record: Record<string, unknown>): unknown[] {
  for (const key of CHILD_COLLECTION_KEYS) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function parseRawJsonNode(
  rawNode: Record<string, unknown>,
  index: number,
  defaultParentRef?: string | null
): ParsedWorkItemNode {
  const temporaryIdentifier =
    extractFirstString(rawNode, ['temporaryIdentifier', 'id', 'tempid']) ??
    `item-${index + 1}`;

  const title =
    extractFirstString(rawNode, ['title', 'name', 'summary']) ??
    `Work Item ${index + 1}`;

  const rawType = extractFirstString(rawNode, [
    'type',
    'kind',
    'issue_type',
    'issuetype',
  ]);
  const itemType: WorkItemType = mapToWorkItemType(rawType);

  const priority = normalizePriority(rawNode.priority);

  const description =
    extractFirstString(rawNode, ['description', 'details', 'desc']) ?? null;

  const parentReference =
    extractFirstString(rawNode, [
      'parentReference',
      'parentId',
      'parent_id',
      'parent',
      'parentTitle',
      'parent_reference',
      'epic',
    ]) ??
    defaultParentRef ??
    null;

  const storyPoints = extractFirstNumber(rawNode, [
    'storyPoints',
    'story_points',
    'points',
    'estimate',
  ]);

  const dueDate =
    extractFirstString(rawNode, ['dueDate', 'due_date', 'deadline']) ?? null;

  const labels = normalizeLabels(rawNode.labels || rawNode.tags);

  const jiraIssueKey =
    extractFirstString(rawNode, [
      'jiraIssueKey',
      'jira_issue_key',
      'jiraKey',
      'key',
    ]) ?? null;

  const dynamicFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawNode)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!STANDARD_FIELD_KEYS.has(normalizedKey)) {
      dynamicFields[key] = value;
    }
  }

  const rawChildren = extractRawChildren(rawNode);
  const children: ParsedWorkItemNode[] = rawChildren.map(
    (childItem, childIndex) =>
      parseRawJsonNode(
        childItem as Record<string, unknown>,
        childIndex,
        temporaryIdentifier
      )
  );

  return {
    temporaryIdentifier,
    title,
    type: itemType,
    priority,
    description,
    storyPoints,
    dueDate,
    labels,
    jiraIssueKey,
    parentReference,
    children: children.length > 0 ? children : undefined,
    dynamicFields:
      Object.keys(dynamicFields).length > 0 ? dynamicFields : undefined,
  };
}

function findCandidateArray(record: Record<string, unknown>): unknown[] | null {
  for (const key of CANDIDATE_ARRAY_KEYS) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return null;
}

function transformParsedStructureToNodes(
  parsed: unknown,
  formatName: string
): ParsedWorkItemNode[] {
  if (Array.isArray(parsed)) {
    return parsed.map((item, index) =>
      parseRawJsonNode(item as Record<string, unknown>, index)
    );
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const record = parsed as Record<string, unknown>;
    const candidateArray = findCandidateArray(record);

    if (candidateArray) {
      return candidateArray.map((item, index) =>
        parseRawJsonNode(item as Record<string, unknown>, index)
      );
    }

    return [parseRawJsonNode(record, 0)];
  }

  throw new Error(`Expected a ${formatName} object or array of work items.`);
}

export function parseJsonWorkItemDocument(
  fileContent: string
): ParsedWorkItemNode[] {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(fileContent);
  } catch (error: unknown) {
    throw new Error(
      `Invalid JSON work-item document: ${error instanceof Error ? error.message : 'Syntax error'}`
    );
  }

  return transformParsedStructureToNodes(parsedJson, 'JSON');
}

const DELIMITER_RULES: readonly {
  delimiter: string;
  matches: (firstLine: string) => boolean;
}[] = [
  { delimiter: '\t', matches: (line) => line.includes('\t') },
  { delimiter: ';', matches: (line) => line.includes(';') && !line.includes(',') },
  { delimiter: '|', matches: (line) => line.includes('|') && !line.includes(',') },
];

function detectDelimiter(firstLine: string): string {
  const matched = DELIMITER_RULES.find((rule) => rule.matches(firstLine));
  return matched?.delimiter ?? ',';
}

function processDelimitedChar(
  char: string,
  nextChar: string | undefined,
  delimiter: string,
  state: { inQuotes: boolean; currentField: string; currentRow: string[] },
  rows: string[][]
): number {
  if (char === '"') {
    if (state.inQuotes && nextChar === '"') {
      state.currentField += '"';
      return 1;
    }
    state.inQuotes = !state.inQuotes;
    return 0;
  }

  if (char === delimiter && !state.inQuotes) {
    state.currentRow.push(state.currentField.trim());
    state.currentField = '';
    return 0;
  }

  if ((char === '\r' || char === '\n') && !state.inQuotes) {
    const skipNext = char === '\r' && nextChar === '\n' ? 1 : 0;
    state.currentRow.push(state.currentField.trim());
    state.currentField = '';
    if (state.currentRow.some((field) => field.length > 0)) {
      rows.push(state.currentRow);
    }
    state.currentRow = [];
    return skipNext;
  }

  state.currentField += char;
  return 0;
}

function tokenizeDelimitedContent(
  content: string,
  delimiter: string
): string[][] {
  const rows: string[][] = [];
  const state = { inQuotes: false, currentField: '', currentRow: [] as string[] };

  for (let i = 0; i < content.length; i++) {
    const skip = processDelimitedChar(
      content[i]!,
      content[i + 1],
      delimiter,
      state,
      rows
    );
    i += skip;
  }

  if (state.currentField.length > 0 || state.currentRow.length > 0) {
    state.currentRow.push(state.currentField.trim());
    if (state.currentRow.some((field) => field.length > 0)) {
      rows.push(state.currentRow);
    }
  }

  return rows;
}

const DELIMITED_FIELD_ALIASES = {
  id: ['temporaryidentifier', 'tempid', 'id', 'issueid'],
  jiraIssueKey: ['jiraissuekey', 'jirakey', 'issuekey', 'key'],
  title: ['title', 'name', 'summary', 'taskname', 'workitem', 'task'],
  type: ['type', 'issuetype', 'issue_type', 'kind', 'workitemtype'],
  description: ['description', 'desc', 'details'],
  parent: [
    'parent',
    'parentid',
    'parentreference',
    'parentkey',
    'parenttitle',
    'parentname',
    'parentsummary',
    'parentlink',
    'epic',
    'epiclink',
    'epickey',
    'epictitle',
  ],
  storyPoints: ['storypoints', 'points', 'estimate'],
  dueDate: ['duedate', 'due_date', 'deadline'],
} as const;

function extractFirstValueFromRow(
  rowObject: Record<string, string>,
  aliases: readonly string[]
): string | null {
  for (const alias of aliases) {
    const val = rowObject[alias];
    if (val) return val;
  }
  return null;
}

function parseDelimitedRowToWorkItem(
  rowValues: string[],
  rawHeaders: string[],
  normalizedHeaders: string[],
  lineIndex: number
): ParsedWorkItemNode {
  const rowObject: Record<string, string> = {};
  const dynamicFields: Record<string, unknown> = {};

  for (let colIndex = 0; colIndex < rawHeaders.length; colIndex++) {
    const originalHeader = rawHeaders[colIndex] || `col_${colIndex}`;
    const normalizedHeader = normalizedHeaders[colIndex] || '';
    const cellValue = rowValues[colIndex] ?? '';

    rowObject[normalizedHeader] = cellValue;

    if (!STANDARD_FIELD_KEYS.has(normalizedHeader) && cellValue) {
      dynamicFields[originalHeader] = cellValue;
    }
  }

  const idValue = extractFirstValueFromRow(
    rowObject,
    DELIMITED_FIELD_ALIASES.id
  );
  const jiraIssueKey = extractFirstValueFromRow(
    rowObject,
    DELIMITED_FIELD_ALIASES.jiraIssueKey
  );
  const temporaryIdentifier = idValue || jiraIssueKey || `row-${lineIndex}`;

  const title =
    extractFirstValueFromRow(rowObject, DELIMITED_FIELD_ALIASES.title) ||
    `Work Item ${lineIndex}`;

  const rawType = extractFirstValueFromRow(
    rowObject,
    DELIMITED_FIELD_ALIASES.type
  );
  const itemType: WorkItemType = mapToWorkItemType(rawType);

  const priority = normalizePriority(rowObject.priority);

  const description = extractFirstValueFromRow(
    rowObject,
    DELIMITED_FIELD_ALIASES.description
  );

  const parentReference = extractFirstValueFromRow(
    rowObject,
    DELIMITED_FIELD_ALIASES.parent
  );

  const rawPoints = extractFirstValueFromRow(
    rowObject,
    DELIMITED_FIELD_ALIASES.storyPoints
  );
  const storyPoints =
    rawPoints && !Number.isNaN(Number(rawPoints))
      ? Math.round(Number(rawPoints))
      : null;

  const dueDate = extractFirstValueFromRow(
    rowObject,
    DELIMITED_FIELD_ALIASES.dueDate
  );

  const labels = normalizeLabels(rowObject.labels || rowObject.tags);

  return {
    temporaryIdentifier,
    title,
    type: itemType,
    priority,
    description,
    storyPoints,
    dueDate,
    labels,
    jiraIssueKey,
    parentReference,
    dynamicFields:
      Object.keys(dynamicFields).length > 0 ? dynamicFields : undefined,
  };
}

export function parseDelimitedWorkItemDocument(
  fileContent: string
): ParsedWorkItemNode[] {
  const firstLine = fileContent.split(/\r?\n/)[0] || '';
  if (!firstLine.trim()) return [];

  const delimiter = detectDelimiter(firstLine);
  const rows = tokenizeDelimitedContent(fileContent, delimiter);

  if (rows.length === 0) return [];

  const rawHeaders = rows[0] || [];
  const normalizedHeaders = rawHeaders.map((header) =>
    header.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  const parsedItems: ParsedWorkItemNode[] = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const rowValues = rows[rowIndex];
    if (!rowValues || rowValues.every((c) => !c)) continue;

    parsedItems.push(
      parseDelimitedRowToWorkItem(
        rowValues,
        rawHeaders,
        normalizedHeaders,
        rowIndex
      )
    );
  }

  return parsedItems;
}

export const parseCsvWorkItemDocument = parseDelimitedWorkItemDocument;

function isMarkdownTable(content: string): boolean {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return false;
  const first = lines[0] || '';
  const second = lines[1] || '';
  return (
    first.includes('|') &&
    second.includes('|') &&
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
  const tableLines = rawLines.filter((line) => line.includes('|'));
  if (tableLines.length < 2) return [];

  const cleanHeaderLine = tableLines[0]!.replace(/^\|/, '').replace(/\|$/, '');
  const rawHeaders = cleanHeaderLine.split('|').map((h) => h.trim());
  const normalizedHeaders = rawHeaders.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  const parsedItems: ParsedWorkItemNode[] = [];
  let itemIndex = 1;

  for (let i = 1; i < tableLines.length; i++) {
    const line = tableLines[i]!;
    if (line.replace(/[\s|:-]/g, '').length === 0) continue;

    const cleanLine = line.replace(/^\|/, '').replace(/\|$/, '');
    const rowValues = cleanLine.split('|').map((c) => c.trim());

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

function isIndentedOutline(content: string): boolean {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return false;
  const bulletCount = lines.filter((l) =>
    /^[-*+]\s|^[\d.]+\s/.test(l)
  ).length;
  return bulletCount >= 2;
}

interface OutlineStackItem {
  indent: number;
  identifier: string;
  title: string;
}

const OUTLINE_TYPE_PATTERNS: readonly RegExp[] = [
  /^\[(Epic|Feature|Story|Task|Issue|Bug)\]\s*(.*)/i,
  /^(Epic|Feature|Story|Task|Issue|Bug):\s*(.*)/i,
];

function extractTypeFromOutlineLine(text: string): {
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

interface InlineMetadataAccumulator {
  priority?: WorkItemPriority;
  storyPoints: number | null;
  key: string | null;
}

const INLINE_METADATA_HANDLERS: Readonly<
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

function parseInlineMetadata(metaStr: string): {
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

function extractMetadataFromOutlineLine(text: string): {
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
    const expandedLine = line.replaceAll('\t', '  ');
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

const YAML_LITERAL_MAP: Readonly<Record<string, unknown>> = {
  true: true,
  false: false,
  null: null,
  '~': null,
};

function parseYamlScalar(val: string): unknown {
  if (Object.prototype.hasOwnProperty.call(YAML_LITERAL_MAP, val)) {
    return YAML_LITERAL_MAP[val];
  }
  if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    return val.slice(1, -1);
  }
  return val;
}

interface YamlParserState {
  lineIdx: number;
}

function parseYamlListEntry(
  lines: string[],
  state: YamlParserState,
  curIndent: number,
  contentAfterDash: string
): unknown {
  if (contentAfterDash.includes(':') && !contentAfterDash.startsWith('{')) {
    const colonIdx = contentAfterDash.indexOf(':');
    const firstKey = contentAfterDash.slice(0, colonIdx).trim();
    const firstVal = parseYamlScalar(
      contentAfterDash.slice(colonIdx + 1).trim()
    );
    const obj: Record<string, unknown> = { [firstKey]: firstVal };

    const childIndent = curIndent + 2;
    while (state.lineIdx < lines.length) {
      const nextLine = lines[state.lineIdx]!;
      const nextIndent = nextLine.search(/\S/);
      const nextTrimmed = nextLine.trim();

      if (nextIndent < childIndent || nextTrimmed.startsWith('- ')) break;

      const nextColon = nextTrimmed.indexOf(':');
      if (nextColon > 0) {
        const k = nextTrimmed.slice(0, nextColon).trim();
        const vRaw = nextTrimmed.slice(nextColon + 1).trim();
        state.lineIdx++;
        obj[k] =
          vRaw.length === 0
            ? parseYamlBlock(lines, state, nextIndent + 2)
            : parseYamlScalar(vRaw);
      } else {
        state.lineIdx++;
      }
    }
    return obj;
  }
  return parseYamlScalar(contentAfterDash);
}

function parseYamlList(
  lines: string[],
  state: YamlParserState,
  currentIndent: number
): unknown[] {
  const list: unknown[] = [];
  while (state.lineIdx < lines.length) {
    const curLine = lines[state.lineIdx]!;
    const curIndent = curLine.search(/\S/);
    const curTrimmed = curLine.trim();

    if (curIndent < currentIndent || !curTrimmed.startsWith('- ')) break;

    const contentAfterDash = curTrimmed.slice(2).trim();
    state.lineIdx++;
    list.push(parseYamlListEntry(lines, state, curIndent, contentAfterDash));
  }
  return list;
}

function parseYamlObject(
  lines: string[],
  state: YamlParserState,
  currentIndent: number
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  while (state.lineIdx < lines.length) {
    const curLine = lines[state.lineIdx]!;
    const curIndent = curLine.search(/\S/);
    const curTrimmed = curLine.trim();

    if (curIndent < currentIndent || curTrimmed.startsWith('- ')) break;

    const colonIdx = curTrimmed.indexOf(':');
    if (colonIdx > 0) {
      const k = curTrimmed.slice(0, colonIdx).trim();
      const vRaw = curTrimmed.slice(colonIdx + 1).trim();
      state.lineIdx++;
      obj[k] =
        vRaw.length === 0
          ? parseYamlBlock(lines, state, curIndent + 2)
          : parseYamlScalar(vRaw);
    } else {
      state.lineIdx++;
    }
  }
  return obj;
}

function parseYamlBlock(
  lines: string[],
  state: YamlParserState,
  currentIndent: number
): unknown {
  if (state.lineIdx >= lines.length) return null;
  const line = lines[state.lineIdx]!;
  const trimmed = line.trim();
  const indent = line.search(/\S/);

  if (indent < currentIndent) return null;

  if (trimmed.startsWith('- ')) {
    return parseYamlList(lines, state, currentIndent);
  }

  if (trimmed.includes(':')) {
    return parseYamlObject(lines, state, currentIndent);
  }

  return null;
}

function parseSimpleYaml(content: string): unknown {
  const lines = content
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0 && !l.trim().startsWith('#'));
  if (lines.length === 0) return null;

  const state: YamlParserState = { lineIdx: 0 };
  return parseYamlBlock(lines, state, 0);
}

export function parseYamlWorkItemDocument(
  fileContent: string
): ParsedWorkItemNode[] {
  const parsed = parseSimpleYaml(fileContent);
  return transformParsedStructureToNodes(parsed, 'YAML');
}

type AttachmentParser = (content: string) => ParsedWorkItemNode[];

interface AttachmentParserEntry {
  readonly name: string;
  readonly matches: (
    fileName: string,
    fileType: ChatAttachmentFileTypeEnum,
    content: string
  ) => boolean;
  readonly parse: AttachmentParser;
}

const PARSER_REGISTRY: readonly AttachmentParserEntry[] = [
  {
    name: 'json',
    matches: (name, type) =>
      type === ChatAttachmentFileTypeEnum.Json || name.endsWith('.json'),
    parse: parseJsonWorkItemDocument,
  },
  {
    name: 'yaml',
    matches: (name) => name.endsWith('.yaml') || name.endsWith('.yml'),
    parse: parseYamlWorkItemDocument,
  },
  {
    name: 'csv',
    matches: (name, type) =>
      type === ChatAttachmentFileTypeEnum.Csv ||
      name.endsWith('.csv') ||
      name.endsWith('.tsv'),
    parse: parseDelimitedWorkItemDocument,
  },
  {
    name: 'markdown_table',
    matches: (_name, _type, content) => isMarkdownTable(content),
    parse: parseMarkdownTableWorkItemDocument,
  },
  {
    name: 'indented_outline',
    matches: (_name, _type, content) => isIndentedOutline(content),
    parse: parseIndentedTextWorkItemDocument,
  },
];

function tryFallbackParsers(content: string): ParsedWorkItemNode[] {
  try {
    return parseJsonWorkItemDocument(content);
  } catch {
    return parseDelimitedWorkItemDocument(content);
  }
}

function parseAttachmentContent(
  textContent: string,
  fileName: string,
  fileType: ChatAttachmentFileTypeEnum
): ParsedWorkItemNode[] {
  const lowerName = fileName.toLowerCase();

  const matchedEntry = PARSER_REGISTRY.find((entry) =>
    entry.matches(lowerName, fileType, textContent)
  );

  if (matchedEntry) {
    return matchedEntry.parse(textContent);
  }

  return tryFallbackParsers(textContent);
}

export async function fetchAndParseWorkItemAttachment(
  attachmentUrl: string,
  fileName: string,
  fileType: ChatAttachmentFileTypeEnum
): Promise<{
  items: ParsedWorkItemNode[];
  summary: string;
}> {
  let textContent = '';
  try {
    const response = await fetch(attachmentUrl);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    textContent = await response.text();
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to download attachment from URL ${sanitizeLog(attachmentUrl)}:`,
      sanitizeLog(errorMsg)
    );
    throw new Error(`Could not access attachment: ${errorMsg}`);
  }

  const parsedItems = parseAttachmentContent(textContent, fileName, fileType);

  let totalChildCount = 0;
  let dynamicFieldsCount = 0;
  for (const item of parsedItems) {
    if (item.children?.length) {
      totalChildCount += item.children.length;
    }
    if (item.dynamicFields) {
      dynamicFieldsCount += Object.keys(item.dynamicFields).length;
    }
  }

  const summary = `Successfully parsed "${fileName}": Found ${parsedItems.length} root work items, ${totalChildCount} subtasks/children, and ${dynamicFieldsCount} dynamic custom fields.`;

  return { items: parsedItems, summary };
}
