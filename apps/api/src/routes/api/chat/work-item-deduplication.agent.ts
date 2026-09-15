import {
  WorkItemDeduplicationActionEnum,
  WorkItemDeduplicationMatchStatusEnum,
  type ParsedWorkItemNode,
  type WorkItemDeduplicationItemResult,
  type WorkItemDeduplicationReport,
} from '@repo/types';
import { prisma } from '../../../lib/prisma';

export interface ExistingWorkItemSummary {
  readonly id: string;
  readonly title: string;
  readonly jira_issue_key: string | null;
  readonly type: string;
  readonly status: string;
  readonly parent_id: string | null;
  readonly priority: string | null;
  readonly story_points: number | null;
  readonly description: unknown;
}

const POTENTIAL_DUPLICATE_SIMILARITY_THRESHOLD = 0.7;

function calculateWordJaccardSimilarity(textA: string, textB: string): number {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2);

  const wordsA = new Set(normalize(textA));
  const wordsB = new Set(normalize(textB));

  if (wordsA.size === 0 || wordsB.size === 0) {
    return 0;
  }

  let intersectionCount = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersectionCount++;
    }
  }

  const unionCount = new Set([...wordsA, ...wordsB]).size;
  return intersectionCount / unionCount;
}

function extractPlainTextFromDescription(description: unknown): string {
  if (!description) return '';
  if (typeof description === 'string') return description.trim();
  if (typeof description === 'object') {
    let text = '';
    const extractText = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const record = node as Record<string, unknown>;
      if (typeof record.text === 'string') {
        text += record.text + ' ';
      }
      if (Array.isArray(record.content)) {
        for (const child of record.content) {
          extractText(child);
        }
      }
    };
    extractText(description);
    return text.trim();
  }
  return '';
}

function flattenParsedWorkItems(
  items: ParsedWorkItemNode[]
): ParsedWorkItemNode[] {
  const result: ParsedWorkItemNode[] = [];

  function traverse(
    node: ParsedWorkItemNode,
    inheritedParentRef?: string | null
  ) {
    const effectiveParentRef =
      node.parentReference || inheritedParentRef || null;
    const currentRef =
      node.temporaryIdentifier || node.jiraIssueKey || node.title;

    result.push({
      ...node,
      parentReference: effectiveParentRef,
    });

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        traverse(child, currentRef);
      }
    }
  }

  for (const item of items) {
    traverse(item, item.parentReference || null);
  }

  return result;
}

function resolveIncomingParent(
  incoming: ParsedWorkItemNode,
  incomingByRef: Map<string, ParsedWorkItemNode>,
  existingWorkItems: ExistingWorkItemSummary[],
  existingById: Map<string, ExistingWorkItemSummary>
): {
  readonly parentId: string | null;
  readonly parentTitle: string | null;
} {
  const ref = incoming.parentReference?.trim();
  if (!ref) {
    return { parentId: null, parentTitle: null };
  }

  if (existingById.has(ref)) {
    const parentItem = existingById.get(ref)!;
    return { parentId: parentItem.id, parentTitle: parentItem.title };
  }

  const normalizedRef = ref.toLowerCase();
  const directExistingMatch = existingWorkItems.find(
    (e) =>
      e.jira_issue_key?.toLowerCase() === normalizedRef ||
      e.title.trim().toLowerCase() === normalizedRef
  );
  if (directExistingMatch) {
    return {
      parentId: directExistingMatch.id,
      parentTitle: directExistingMatch.title,
    };
  }

  const parentIncomingNode =
    incomingByRef.get(ref) ||
    incomingByRef.get(normalizedRef) ||
    incomingByRef.get(ref.toUpperCase());
  if (parentIncomingNode) {
    const matchedExistingForParent = existingWorkItems.find(
      (e) =>
        (parentIncomingNode.jiraIssueKey &&
          e.jira_issue_key?.toUpperCase() ===
            parentIncomingNode.jiraIssueKey.toUpperCase()) ||
        e.title.trim().toLowerCase() ===
          parentIncomingNode.title.trim().toLowerCase()
    );
    if (matchedExistingForParent) {
      return {
        parentId: matchedExistingForParent.id,
        parentTitle: matchedExistingForParent.title,
      };
    }
    return { parentId: null, parentTitle: parentIncomingNode.title };
  }

  return { parentId: null, parentTitle: ref };
}

interface HierarchyDiff {
  readonly hasHierarchyChange: boolean;
  readonly oldParentTitle: string | null;
  readonly newParentTitle: string | null;
}

function checkHierarchyDifference(
  incoming: ParsedWorkItemNode,
  exactMatch: ExistingWorkItemSummary,
  incomingByRef: Map<string, ParsedWorkItemNode>,
  existingWorkItems: ExistingWorkItemSummary[],
  existingById: Map<string, ExistingWorkItemSummary>
): HierarchyDiff {
  const { parentId: incomingParentId, parentTitle: incomingParentTitle } =
    resolveIncomingParent(
      incoming,
      incomingByRef,
      existingWorkItems,
      existingById
    );

  const existingParentId = exactMatch.parent_id ?? null;
  const existingParentTitle = existingParentId
    ? (existingById.get(existingParentId)?.title ?? null)
    : null;

  if (incomingParentId === null && !incoming.parentReference) {
    if (existingParentId !== null) {
      return {
        hasHierarchyChange: true,
        oldParentTitle: existingParentTitle || 'Previous Parent',
        newParentTitle: 'Root (No parent)',
      };
    }
    return {
      hasHierarchyChange: false,
      oldParentTitle: null,
      newParentTitle: null,
    };
  }

  if (existingParentId === null) {
    return {
      hasHierarchyChange: true,
      oldParentTitle: 'Root (No parent)',
      newParentTitle: incomingParentTitle || 'Parent',
    };
  }

  if (incomingParentId !== null && incomingParentId !== existingParentId) {
    return {
      hasHierarchyChange: true,
      oldParentTitle: existingParentTitle || 'Previous Parent',
      newParentTitle: incomingParentTitle || 'New Parent',
    };
  }

  if (
    incomingParentId === null &&
    incoming.parentReference &&
    existingParentTitle?.toLowerCase() !== incoming.parentReference.toLowerCase()
  ) {
    return {
      hasHierarchyChange: true,
      oldParentTitle: existingParentTitle || 'Previous Parent',
      newParentTitle: incomingParentTitle || incoming.parentReference,
    };
  }

  return {
    hasHierarchyChange: false,
    oldParentTitle: null,
    newParentTitle: null,
  };
}

function collectFieldDifferences(
  incoming: ParsedWorkItemNode,
  exactMatch: ExistingWorkItemSummary
): string[] {
  const fieldChanges: string[] = [];

  if (
    incoming.type &&
    exactMatch.type &&
    incoming.type.toLowerCase() !== exactMatch.type.toLowerCase()
  ) {
    fieldChanges.push(`Type: ${exactMatch.type} -> ${incoming.type}`);
  }

  if (
    incoming.priority &&
    exactMatch.priority &&
    incoming.priority.toLowerCase() !== exactMatch.priority.toLowerCase()
  ) {
    fieldChanges.push(
      `Priority: ${exactMatch.priority} -> ${incoming.priority}`
    );
  }

  if (
    incoming.storyPoints != null &&
    incoming.storyPoints !== exactMatch.story_points
  ) {
    fieldChanges.push(
      `Story Points: ${exactMatch.story_points ?? 'None'} -> ${incoming.storyPoints}`
    );
  }

  if (incoming.description) {
    const existingDescText = extractPlainTextFromDescription(
      exactMatch.description
    );
    if (
      existingDescText &&
      incoming.description.trim().toLowerCase() !==
        existingDescText.toLowerCase()
    ) {
      fieldChanges.push('Description updated');
    }
  }

  return fieldChanges;
}

function buildExactMatchResult(
  incoming: ParsedWorkItemNode,
  exactMatch: ExistingWorkItemSummary,
  hierarchyDiff: HierarchyDiff,
  fieldChanges: string[]
): WorkItemDeduplicationItemResult {
  const { hasHierarchyChange, oldParentTitle, newParentTitle } = hierarchyDiff;
  const hasFieldChanges = fieldChanges.length > 0;

  if (hasHierarchyChange || hasFieldChanges) {
    const reasons: string[] = [];
    if (hasHierarchyChange) {
      reasons.push(
        `Hierarchy updated (parent: "${oldParentTitle}" -> "${newParentTitle}")`
      );
    }
    if (hasFieldChanges) {
      reasons.push(`Fields modified (${fieldChanges.join(', ')})`);
    }

    return {
      incomingItem: incoming,
      matchStatus: WorkItemDeduplicationMatchStatusEnum.Modified,
      existingWorkItemId: exactMatch.id,
      existingWorkItemKey: exactMatch.jira_issue_key,
      existingWorkItemTitle: exactMatch.title,
      matchReason: reasons.join('; '),
      recommendedAction: WorkItemDeduplicationActionEnum.Update,
      hasHierarchyChange,
      oldParentTitle,
      newParentTitle,
      hasFieldChanges,
      fieldChanges,
    };
  }

  return {
    incomingItem: incoming,
    matchStatus: WorkItemDeduplicationMatchStatusEnum.ExactDuplicate,
    existingWorkItemId: exactMatch.id,
    existingWorkItemKey: exactMatch.jira_issue_key,
    existingWorkItemTitle: exactMatch.title,
    matchReason: `Exact match found with existing work item "${exactMatch.title}" (no changes detected).`,
    recommendedAction: WorkItemDeduplicationActionEnum.Skip,
    hasHierarchyChange: false,
    hasFieldChanges: false,
  };
}

function findExactMatch(
  incoming: ParsedWorkItemNode,
  existingWorkItems: ExistingWorkItemSummary[]
): ExistingWorkItemSummary | undefined {
  if (incoming.jiraIssueKey) {
    const matchByKey = existingWorkItems.find(
      (existing) =>
        existing.jira_issue_key?.toUpperCase() ===
        incoming.jiraIssueKey?.toUpperCase()
    );
    if (matchByKey) return matchByKey;
  }

  const normalizedTitle = incoming.title.trim().toLowerCase();
  return existingWorkItems.find(
    (existing) => existing.title.trim().toLowerCase() === normalizedTitle
  );
}

function checkPotentialDuplicate(
  incoming: ParsedWorkItemNode,
  existingWorkItems: ExistingWorkItemSummary[]
): WorkItemDeduplicationItemResult | null {
  let highestSimilarity = 0;
  let mostSimilarItem: ExistingWorkItemSummary | null = null;

  for (const existing of existingWorkItems) {
    const similarity = calculateWordJaccardSimilarity(
      incoming.title,
      existing.title
    );
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      mostSimilarItem = existing;
    }
  }

  if (
    highestSimilarity >= POTENTIAL_DUPLICATE_SIMILARITY_THRESHOLD &&
    mostSimilarItem
  ) {
    return {
      incomingItem: incoming,
      matchStatus: WorkItemDeduplicationMatchStatusEnum.PotentialDuplicate,
      existingWorkItemId: mostSimilarItem.id,
      existingWorkItemKey: mostSimilarItem.jira_issue_key,
      existingWorkItemTitle: mostSimilarItem.title,
      matchReason: `High title similarity (${Math.round(highestSimilarity * 100)}%) with existing work item "${mostSimilarItem.title}".`,
      recommendedAction: WorkItemDeduplicationActionEnum.Create,
      hasHierarchyChange: false,
      hasFieldChanges: false,
    };
  }

  return null;
}

function evaluateIncomingItemMatch(params: {
  incoming: ParsedWorkItemNode;
  existingWorkItems: ExistingWorkItemSummary[];
  existingById: Map<string, ExistingWorkItemSummary>;
  incomingByRef: Map<string, ParsedWorkItemNode>;
}): WorkItemDeduplicationItemResult {
  const { incoming, existingWorkItems, existingById, incomingByRef } = params;

  const exactMatch = findExactMatch(incoming, existingWorkItems);
  if (exactMatch) {
    const hierarchyDiff = checkHierarchyDifference(
      incoming,
      exactMatch,
      incomingByRef,
      existingWorkItems,
      existingById
    );
    const fieldChanges = collectFieldDifferences(incoming, exactMatch);
    return buildExactMatchResult(
      incoming,
      exactMatch,
      hierarchyDiff,
      fieldChanges
    );
  }

  const potentialDup = checkPotentialDuplicate(incoming, existingWorkItems);
  if (potentialDup) {
    return potentialDup;
  }

  return {
    incomingItem: incoming,
    matchStatus: WorkItemDeduplicationMatchStatusEnum.New,
    existingWorkItemId: null,
    existingWorkItemKey: null,
    existingWorkItemTitle: null,
    matchReason: 'No existing duplicates found in target project.',
    recommendedAction: WorkItemDeduplicationActionEnum.Create,
    hasHierarchyChange: false,
    hasFieldChanges: false,
  };
}

function buildIncomingReferenceMap(
  flatIncomingItems: ParsedWorkItemNode[]
): Map<string, ParsedWorkItemNode> {
  const incomingByRef = new Map<string, ParsedWorkItemNode>();
  for (const item of flatIncomingItems) {
    if (item.temporaryIdentifier) {
      incomingByRef.set(item.temporaryIdentifier, item);
      incomingByRef.set(item.temporaryIdentifier.toLowerCase(), item);
    }
    if (item.jiraIssueKey) {
      incomingByRef.set(item.jiraIssueKey, item);
      incomingByRef.set(item.jiraIssueKey.toLowerCase(), item);
    }
    if (item.title) {
      incomingByRef.set(item.title.toLowerCase().trim(), item);
    }
  }
  return incomingByRef;
}

interface DeduplicationMatchStats {
  itemResults: WorkItemDeduplicationItemResult[];
  newCount: number;
  exactDuplicateCount: number;
  potentialDuplicateCount: number;
  hierarchyChangedCount: number;
  fieldChangedCount: number;
  hierarchyChanges: Array<{
    itemTitle: string;
    itemKey?: string | null;
    oldParentTitle?: string | null;
    newParentTitle?: string | null;
  }>;
}

function processDeduplicationMatches(params: {
  flatIncomingItems: ParsedWorkItemNode[];
  existingWorkItems: ExistingWorkItemSummary[];
  existingById: Map<string, ExistingWorkItemSummary>;
  incomingByRef: Map<string, ParsedWorkItemNode>;
}): DeduplicationMatchStats {
  const { flatIncomingItems, existingWorkItems, existingById, incomingByRef } =
    params;
  const itemResults: WorkItemDeduplicationItemResult[] = [];
  const hierarchyChanges: Array<{
    itemTitle: string;
    itemKey?: string | null;
    oldParentTitle?: string | null;
    newParentTitle?: string | null;
  }> = [];

  let newCount = 0;
  let exactDuplicateCount = 0;
  let potentialDuplicateCount = 0;
  let hierarchyChangedCount = 0;
  let fieldChangedCount = 0;

  for (const incoming of flatIncomingItems) {
    const matchResult = evaluateIncomingItemMatch({
      incoming,
      existingWorkItems,
      existingById,
      incomingByRef,
    });

    if (matchResult.matchStatus === WorkItemDeduplicationMatchStatusEnum.New) {
      newCount++;
    } else if (
      matchResult.matchStatus ===
      WorkItemDeduplicationMatchStatusEnum.PotentialDuplicate
    ) {
      potentialDuplicateCount++;
    } else if (
      matchResult.matchStatus ===
      WorkItemDeduplicationMatchStatusEnum.ExactDuplicate
    ) {
      exactDuplicateCount++;
    }

    if (matchResult.hasHierarchyChange) {
      hierarchyChangedCount++;
      hierarchyChanges.push({
        itemTitle: matchResult.incomingItem.title,
        itemKey: matchResult.existingWorkItemKey,
        oldParentTitle: matchResult.oldParentTitle,
        newParentTitle: matchResult.newParentTitle,
      });
    }

    if (matchResult.hasFieldChanges) {
      fieldChangedCount++;
    }

    itemResults.push(matchResult);
  }

  return {
    itemResults,
    newCount,
    exactDuplicateCount,
    potentialDuplicateCount,
    hierarchyChangedCount,
    fieldChangedCount,
    hierarchyChanges,
  };
}

export class WorkItemDeduplicationAgent {
  async inspectAndDeduplicate(
    projectId: string,
    incomingItems: ParsedWorkItemNode[]
  ): Promise<WorkItemDeduplicationReport> {
    const existingWorkItems: ExistingWorkItemSummary[] =
      await prisma.work_items.findMany({
        where: {
          project_id: projectId,
          record_status: 'active',
        },
        select: {
          id: true,
          title: true,
          jira_issue_key: true,
          type: true,
          status: true,
          parent_id: true,
          priority: true,
          story_points: true,
          description: true,
        },
      });

    const existingById = new Map<string, ExistingWorkItemSummary>(
      existingWorkItems.map((item) => [item.id, item])
    );

    const flatIncomingItems = flattenParsedWorkItems(incomingItems);
    const incomingByRef = buildIncomingReferenceMap(flatIncomingItems);

    const matchStats = processDeduplicationMatches({
      flatIncomingItems,
      existingWorkItems,
      existingById,
      incomingByRef,
    });

    const matchedExistingIds = new Set(
      matchStats.itemResults
        .map((r) => r.existingWorkItemId)
        .filter((id): id is string => Boolean(id))
    );

    const omittedExisting = existingWorkItems.filter(
      (e) => !matchedExistingIds.has(e.id)
    );

    const omittedExistingItems = omittedExisting.map((e) => ({
      id: e.id,
      key: e.jira_issue_key || e.id.slice(0, 8).toUpperCase(),
      title: e.title,
    }));

    return {
      totalCount: flatIncomingItems.length,
      newCount: matchStats.newCount,
      exactDuplicateCount: matchStats.exactDuplicateCount,
      potentialDuplicateCount: matchStats.potentialDuplicateCount,
      hierarchyChangedCount: matchStats.hierarchyChangedCount,
      fieldChangedCount: matchStats.fieldChangedCount,
      hierarchyChanges:
        matchStats.hierarchyChanges.length > 0
          ? matchStats.hierarchyChanges
          : undefined,
      omittedExistingCount: omittedExisting.length,
      omittedExistingItems:
        omittedExisting.length > 0 ? omittedExistingItems : undefined,
      deletionDisallowedNotice:
        omittedExisting.length > 0
          ? 'Deletion of work items is not allowed via Alice chat. The omitted work items will remain in your project backlog.'
          : undefined,
      items: matchStats.itemResults,
    };
  }
}
