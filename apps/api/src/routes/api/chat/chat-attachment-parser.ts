import {
  mapToWorkItemType,
  DEFAULT_WORK_ITEM_PRIORITY,
  WORK_ITEM_PRIORITIES,
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
  'type',
  'issuetype',
  'issue_type',
  'kind',
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
  'parent',
  'parentid',
  'parent_id',
  'parentreference',
  'parent_reference',
  'parenttitle',
  'parent_title',
  'epic',
  'children',
  'subtasks',
  'sub_tasks',
  'items',
  'id',
  'tempid',
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

function extractRawChildren(record: Record<string, unknown>): unknown[] {
  if (Array.isArray(record.children)) return record.children;
  if (Array.isArray(record.subtasks)) return record.subtasks;
  if (Array.isArray(record.sub_tasks)) return record.sub_tasks;
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
  if (Array.isArray(record.workItems)) return record.workItems;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.data)) return record.data;
  return null;
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

  if (Array.isArray(parsedJson)) {
    return parsedJson.map((item, index) =>
      parseRawJsonNode(item as Record<string, unknown>, index)
    );
  }

  if (typeof parsedJson === 'object' && parsedJson !== null) {
    const record = parsedJson as Record<string, unknown>;
    const candidateArray = findCandidateArray(record);

    if (candidateArray) {
      return candidateArray.map((item, index) =>
        parseRawJsonNode(item as Record<string, unknown>, index)
      );
    }

    return [parseRawJsonNode(record, 0)];
  }

  throw new Error('Expected a JSON object or array of work items.');
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      result.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }

  result.push(currentField.trim());
  return result;
}

function parseCsvRowToWorkItem(
  currentLine: string,
  delimiter: string,
  rawHeaders: string[],
  normalizedHeaders: string[],
  lineIndex: number
): ParsedWorkItemNode {
  const rowValues = parseCsvLine(currentLine, delimiter);
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

  const title =
    rowObject.title ||
    rowObject.name ||
    rowObject.summary ||
    rowObject.taskname ||
    `Work Item ${lineIndex}`;

  const rawType =
    rowObject.type ||
    rowObject.issuetype ||
    rowObject.kind ||
    rowObject.workitemtype;
  const itemType: WorkItemType = mapToWorkItemType(rawType);

  const priority = normalizePriority(rowObject.priority);

  const description =
    rowObject.description || rowObject.desc || rowObject.details || null;

  const parentReference =
    rowObject.parent ||
    rowObject.parentid ||
    rowObject.parenttitle ||
    rowObject.epic ||
    null;

  const rawPoints =
    rowObject.storypoints || rowObject.points || rowObject.estimate;
  const storyPoints =
    rawPoints && !Number.isNaN(Number(rawPoints))
      ? Math.round(Number(rawPoints))
      : null;

  const dueDate = rowObject.duedate || rowObject.deadline || null;

  const labels = normalizeLabels(rowObject.labels || rowObject.tags);

  const jiraIssueKey =
    rowObject.jiraissuekey || rowObject.jirakey || rowObject.key || null;

  return {
    temporaryIdentifier: `csv-row-${lineIndex}`,
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

export function parseCsvWorkItemDocument(
  fileContent: string
): ParsedWorkItemNode[] {
  const rawLines = fileContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rawLines.length === 0) {
    return [];
  }

  const headerLine = rawLines[0] || '';
  const delimiter =
    headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';
  const rawHeaders = parseCsvLine(headerLine, delimiter);
  const normalizedHeaders = rawHeaders.map((header) =>
    header.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  const parsedItems: ParsedWorkItemNode[] = [];

  for (let lineIndex = 1; lineIndex < rawLines.length; lineIndex++) {
    const currentLine = rawLines[lineIndex];
    if (!currentLine) continue;

    parsedItems.push(
      parseCsvRowToWorkItem(
        currentLine,
        delimiter,
        rawHeaders,
        normalizedHeaders,
        lineIndex
      )
    );
  }

  return parsedItems;
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

  let parsedItems: ParsedWorkItemNode[] = [];

  if (
    fileType === ChatAttachmentFileTypeEnum.Json ||
    fileName.toLowerCase().endsWith('.json')
  ) {
    parsedItems = parseJsonWorkItemDocument(textContent);
  } else if (
    fileType === ChatAttachmentFileTypeEnum.Csv ||
    fileName.toLowerCase().endsWith('.csv')
  ) {
    parsedItems = parseCsvWorkItemDocument(textContent);
  } else {
    try {
      parsedItems = parseJsonWorkItemDocument(textContent);
    } catch {
      parsedItems = parseCsvWorkItemDocument(textContent);
    }
  }

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
