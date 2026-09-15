import {
  mapToWorkItemType,
  type WorkItemType,
  type ParsedWorkItemNode,
} from '@repo/types';
import {
  STANDARD_FIELD_KEYS,
  normalizePriority,
  normalizeLabels,
  extractFirstString,
  extractFirstNumber,
  extractRawChildren,
  transformParsedStructureToNodes,
} from './chat-attachment-parser.common';

export function parseRawJsonNode(
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

  return transformParsedStructureToNodes(
    parsedJson,
    'JSON',
    parseRawJsonNode
  );
}
