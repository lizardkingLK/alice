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

function flattenParsedWorkItems(
  items: ParsedWorkItemNode[]
): ParsedWorkItemNode[] {
  const result: ParsedWorkItemNode[] = [];

  function traverse(node: ParsedWorkItemNode) {
    result.push(node);
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const item of items) {
    traverse(item);
  }

  return result;
}

function evaluateIncomingItemMatch(
  incoming: ParsedWorkItemNode,
  existingWorkItems: ExistingWorkItemSummary[]
): WorkItemDeduplicationItemResult {
  const normalizedIncomingTitle = incoming.title.trim().toLowerCase();

  // Check 1: Jira Issue Key exact match
  if (incoming.jiraIssueKey) {
    const keyMatch = existingWorkItems.find(
      (existing) =>
        existing.jira_issue_key?.toUpperCase() ===
        incoming.jiraIssueKey?.toUpperCase()
    );

    if (keyMatch) {
      return {
        incomingItem: incoming,
        matchStatus: WorkItemDeduplicationMatchStatusEnum.ExactDuplicate,
        existingWorkItemId: keyMatch.id,
        existingWorkItemKey: keyMatch.jira_issue_key,
        existingWorkItemTitle: keyMatch.title,
        matchReason: `Exact Jira issue key "${incoming.jiraIssueKey}" matches existing work item "${keyMatch.title}".`,
        recommendedAction: WorkItemDeduplicationActionEnum.Skip,
      };
    }
  }

  // Check 2: Exact normalized title match
  const titleExactMatch = existingWorkItems.find(
    (existing) => existing.title.trim().toLowerCase() === normalizedIncomingTitle
  );

  if (titleExactMatch) {
    return {
      incomingItem: incoming,
      matchStatus: WorkItemDeduplicationMatchStatusEnum.ExactDuplicate,
      existingWorkItemId: titleExactMatch.id,
      existingWorkItemKey: titleExactMatch.jira_issue_key,
      existingWorkItemTitle: titleExactMatch.title,
      matchReason: `Exact title match found with existing work item "${titleExactMatch.title}".`,
      recommendedAction: WorkItemDeduplicationActionEnum.Skip,
    };
  }

  // Check 3: Semantic/Token similarity check
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
    };
  }

  // Check 4: No duplicate found -> New Item
  return {
    incomingItem: incoming,
    matchStatus: WorkItemDeduplicationMatchStatusEnum.New,
    existingWorkItemId: null,
    existingWorkItemKey: null,
    existingWorkItemTitle: null,
    matchReason: 'No existing duplicates found in target project.',
    recommendedAction: WorkItemDeduplicationActionEnum.Create,
  };
}

export class WorkItemDeduplicationAgent {
  async inspectAndDeduplicate(
    projectId: string,
    incomingItems: ParsedWorkItemNode[]
  ): Promise<WorkItemDeduplicationReport> {
    const existingWorkItems = await prisma.work_items.findMany({
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
      },
    });

    const flatIncomingItems = flattenParsedWorkItems(incomingItems);
    const itemResults: WorkItemDeduplicationItemResult[] = [];

    let newCount = 0;
    let exactDuplicateCount = 0;
    let potentialDuplicateCount = 0;

    for (const incoming of flatIncomingItems) {
      const matchResult = evaluateIncomingItemMatch(
        incoming,
        existingWorkItems
      );

      if (
        matchResult.matchStatus ===
        WorkItemDeduplicationMatchStatusEnum.ExactDuplicate
      ) {
        exactDuplicateCount++;
      } else if (
        matchResult.matchStatus ===
        WorkItemDeduplicationMatchStatusEnum.PotentialDuplicate
      ) {
        potentialDuplicateCount++;
      } else {
        newCount++;
      }

      itemResults.push(matchResult);
    }

    return {
      totalCount: flatIncomingItems.length,
      newCount,
      exactDuplicateCount,
      potentialDuplicateCount,
      items: itemResults,
    };
  }
}
