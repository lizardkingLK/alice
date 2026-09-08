import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkItemDeduplicationAgent } from '../../src/routes/api/chat/work-item-deduplication.agent';
import {
  WorkItemDeduplicationActionEnum,
  WorkItemDeduplicationMatchStatusEnum,
  WorkItemTypeEnum,
  type ParsedWorkItemNode,
} from '@repo/types';
import { prisma } from '../../src/lib/prisma';

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    work_items: {
      findMany: vi.fn(),
    },
  },
}));

describe('WorkItemDeduplicationAgent', () => {
  let agent: WorkItemDeduplicationAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new WorkItemDeduplicationAgent();
  });

  it('identifies exact title matches, Jira key matches, high similarities, and new items', async () => {
    const existingWorkItems = [
      {
        id: 'existing-uuid-1',
        title: 'Implement Dark Mode',
        jira_issue_key: 'UI-10',
        type: 'Story',
        status: 'Done',
      },
      {
        id: 'existing-uuid-2',
        title: 'Migrate PostgreSQL Database',
        jira_issue_key: 'DB-20',
        type: 'Task',
        status: 'InProgress',
      },
    ];

    vi.mocked(prisma.work_items.findMany).mockResolvedValue(
      existingWorkItems as never
    );

    const incomingItems: ParsedWorkItemNode[] = [
      // 1. Exact title duplicate
      {
        temporaryIdentifier: 'item-1',
        title: 'Implement Dark Mode',
        type: WorkItemTypeEnum.Story,
        priority: 'medium',
        description: null,
      },
      // 2. Exact Jira key duplicate
      {
        temporaryIdentifier: 'item-2',
        title: 'Upgrade PG Cluster',
        jiraIssueKey: 'DB-20',
        type: WorkItemTypeEnum.Task,
        priority: 'high',
        description: null,
      },
      // 3. High similarity duplicate
      {
        temporaryIdentifier: 'item-3',
        title: 'Implement Dark Mode UI Theme',
        type: WorkItemTypeEnum.Task,
        priority: 'low',
        description: null,
      },
      // 4. Brand new item
      {
        temporaryIdentifier: 'item-4',
        title: 'Add Webhook Integration',
        type: WorkItemTypeEnum.Feature,
        priority: 'highest',
        description: 'New feature',
      },
    ];

    const report = await agent.inspectAndDeduplicate('project-123', incomingItems);

    expect(report.totalCount).toBe(4);
    expect(report.exactDuplicateCount).toBe(2);
    expect(report.newCount).toBe(1);

    // Exact title match check
    const match1 = report.items.find((i) => i.incomingItem.temporaryIdentifier === 'item-1');
    expect(match1?.matchStatus).toBe(WorkItemDeduplicationMatchStatusEnum.ExactDuplicate);
    expect(match1?.recommendedAction).toBe(WorkItemDeduplicationActionEnum.Skip);

    // Exact Jira key match check
    const match2 = report.items.find((i) => i.incomingItem.temporaryIdentifier === 'item-2');
    expect(match2?.matchStatus).toBe(WorkItemDeduplicationMatchStatusEnum.ExactDuplicate);
    expect(match2?.recommendedAction).toBe(WorkItemDeduplicationActionEnum.Skip);

    // Brand new item check
    const match4 = report.items.find((i) => i.incomingItem.temporaryIdentifier === 'item-4');
    expect(match4?.matchStatus).toBe(WorkItemDeduplicationMatchStatusEnum.New);
    expect(match4?.recommendedAction).toBe(WorkItemDeduplicationActionEnum.Create);
  });
});
