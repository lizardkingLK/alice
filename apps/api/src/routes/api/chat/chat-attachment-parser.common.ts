import {
  DEFAULT_WORK_ITEM_PRIORITY,
  WORK_ITEM_PRIORITIES,
  type WorkItemPriority,
  type ParsedWorkItemNode,
} from '@repo/types';

export const CARRIAGE_RETURN = '\r';
export const NEW_LINE = '\n';
export const DOUBLE_QUOTE = '"';
export const COMMA = ',';
export const TAB = '\t';
export const SEMICOLON = ';';
export const PIPE = '|';

export const STANDARD_FIELD_KEYS = new Set([
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

export function normalizePriority(rawPriority: unknown): WorkItemPriority {
  if (typeof rawPriority === 'string') {
    const trimmed = rawPriority.trim().toLowerCase();
    if ((WORK_ITEM_PRIORITIES as readonly string[]).includes(trimmed)) {
      return trimmed as WorkItemPriority;
    }
  }
  return DEFAULT_WORK_ITEM_PRIORITY;
}

export function normalizeLabels(rawLabels: unknown): string[] {
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

export function extractFirstString(
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

export function extractFirstNumber(
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

export const CHILD_COLLECTION_KEYS = [
  'children',
  'subtasks',
  'sub_tasks',
] as const;
export const CANDIDATE_ARRAY_KEYS = ['workItems', 'items', 'data'] as const;

export function extractRawChildren(record: Record<string, unknown>): unknown[] {
  for (const key of CHILD_COLLECTION_KEYS) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

export function findCandidateArray(
  record: Record<string, unknown>
): unknown[] | null {
  for (const key of CANDIDATE_ARRAY_KEYS) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return null;
}

export function transformParsedStructureToNodes(
  parsed: unknown,
  formatName: string,
  nodeParser: (
    item: Record<string, unknown>,
    index: number
  ) => ParsedWorkItemNode
): ParsedWorkItemNode[] {
  if (Array.isArray(parsed)) {
    return parsed.map((item, index) =>
      nodeParser(item as Record<string, unknown>, index)
    );
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const record = parsed as Record<string, unknown>;
    const candidateArray = findCandidateArray(record);

    if (candidateArray) {
      return candidateArray.map((item, index) =>
        nodeParser(item as Record<string, unknown>, index)
      );
    }

    return [nodeParser(record, 0)];
  }

  throw new Error(`Expected a ${formatName} object or array of work items.`);
}
