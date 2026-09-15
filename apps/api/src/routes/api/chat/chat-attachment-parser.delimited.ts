import {
  mapToWorkItemType,
  type WorkItemType,
  type ParsedWorkItemNode,
} from '@repo/types';
import {
  CARRIAGE_RETURN,
  NEW_LINE,
  DOUBLE_QUOTE,
  COMMA,
  TAB,
  SEMICOLON,
  PIPE,
  STANDARD_FIELD_KEYS,
  normalizePriority,
  normalizeLabels,
} from './chat-attachment-parser.common';

export const DELIMITER_RULES: readonly {
  delimiter: string;
  matches: (firstLine: string) => boolean;
}[] = [
  { delimiter: TAB, matches: (line) => line.includes(TAB) },
  {
    delimiter: SEMICOLON,
    matches: (line) => line.includes(SEMICOLON) && !line.includes(COMMA),
  },
  {
    delimiter: PIPE,
    matches: (line) => line.includes(PIPE) && !line.includes(COMMA),
  },
];

export function detectDelimiter(firstLine: string): string {
  const matched = DELIMITER_RULES.find((rule) => rule.matches(firstLine));
  return matched?.delimiter ?? COMMA;
}

export function processDelimitedChar(
  char: string,
  nextChar: string | undefined,
  delimiter: string,
  state: { inQuotes: boolean; currentField: string; currentRow: string[] },
  rows: string[][]
): number {
  if (char === DOUBLE_QUOTE) {
    if (state.inQuotes && nextChar === DOUBLE_QUOTE) {
      state.currentField += DOUBLE_QUOTE;
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

  if ((char === CARRIAGE_RETURN || char === NEW_LINE) && !state.inQuotes) {
    const skipNext = char === CARRIAGE_RETURN && nextChar === NEW_LINE ? 1 : 0;
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

export function tokenizeDelimitedContent(
  content: string,
  delimiter: string
): string[][] {
  const rows: string[][] = [];
  const state = {
    inQuotes: false,
    currentField: '',
    currentRow: [] as string[],
  };

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

export const DELIMITED_FIELD_ALIASES = {
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

export function extractFirstValueFromRow(
  rowObject: Record<string, string>,
  aliases: readonly string[]
): string | null {
  for (const alias of aliases) {
    const val = rowObject[alias];
    if (val) return val;
  }
  return null;
}

export function parseDelimitedRowToWorkItem(
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
